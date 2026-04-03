import type { AuthOuathResult } from '@opencode-ai/plugin'
import { exec } from 'node:child_process'
import { normalizeRegion } from '../../constants.js'
import type { AccountRepository } from '../../infrastructure/database/account-repository.js'
import { createDeterministicAccountId } from '../../plugin/accounts.js'
import * as logger from '../../plugin/logger.js'
import type { KiroRegion, ManagedAccount } from '../../plugin/types.js'
import { fetchUsageLimits } from '../../plugin/usage.js'

const openBrowser = (url: string) => {
  const escapedUrl = url.replace(/"/g, '\\"')
  const platform = process.platform
  const cmd =
    platform === 'win32'
      ? `cmd /c start "" "${escapedUrl}"`
      : platform === 'darwin'
        ? `open "${escapedUrl}"`
        : `xdg-open "${escapedUrl}"`
  exec(cmd, (error) => {
    if (error) logger.warn(`Browser error: ${error.message}`)
  })
}

export interface KiroGoogleAuthorization {
  verificationUrl: string
  userCode: string
  deviceCode: string
  interval: number
  expiresIn: number
  region: KiroRegion
}

export interface KiroGoogleTokenResult {
  refreshToken: string
  accessToken: string
  expiresAt: number
  email: string
  region: KiroRegion
  authMethod: 'google'
}

export async function authorizeKiroGoogle(region?: KiroRegion): Promise<KiroGoogleAuthorization> {
  const effectiveRegion = normalizeRegion(region)
  const authEndpoint = `https://prod.${effectiveRegion}.auth.desktop.kiro.dev`

  try {
    const deviceAuthResponse = await fetch(`${authEndpoint}/device/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'KiroIDE'
      },
      body: JSON.stringify({
        provider: 'google'
      })
    })

    if (!deviceAuthResponse.ok) {
      const errorText = await deviceAuthResponse.text().catch(() => '')
      const error = new Error(
        `Google device authorization failed: ${deviceAuthResponse.status} ${errorText}`
      )
      throw error
    }

    const deviceAuthData = await deviceAuthResponse.json()

    const {
      verification_url,
      verification_uri_complete,
      user_code,
      device_code,
      interval = 5,
      expires_in = 600
    } = deviceAuthData

    const verificationUrl = verification_uri_complete || verification_url

    if (!device_code || !user_code || !verificationUrl) {
      const error = new Error('Google device authorization response missing required fields')
      throw error
    }

    return {
      verificationUrl,
      userCode: user_code,
      deviceCode: device_code,
      interval,
      expiresIn: expires_in,
      region: effectiveRegion
    }
  } catch (error) {
    throw error
  }
}

export async function pollKiroGoogleToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  region: KiroRegion
): Promise<KiroGoogleTokenResult> {
  if (!deviceCode) {
    const error = new Error('Missing required parameters for Google token polling')
    throw error
  }

  const effectiveRegion = normalizeRegion(region)
  const authEndpoint = `https://prod.${effectiveRegion}.auth.desktop.kiro.dev`

  const maxAttempts = Math.floor(expiresIn / interval)
  let currentInterval = interval * 1000
  let attempts = 0

  while (attempts < maxAttempts) {
    attempts++

    await new Promise((resolve) => setTimeout(resolve, currentInterval))

    try {
      const tokenResponse = await fetch(`${authEndpoint}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KiroIDE'
        },
        body: JSON.stringify({
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        })
      })

      const responseText = await tokenResponse.text().catch(() => '')
      let tokenData: any = {}
      if (responseText) {
        try {
          tokenData = JSON.parse(responseText)
        } catch (parseError: any) {
          throw new Error(
            `Google token polling failed: invalid JSON response (HTTP ${tokenResponse.status}): ${responseText.slice(0, 300)}`
          )
        }
      }

      if (tokenData.error) {
        const errorType = tokenData.error

        if (errorType === 'authorization_pending') {
          continue
        }

        if (errorType === 'slow_down') {
          currentInterval += 5000
          continue
        }

        if (errorType === 'expired_token') {
          const error = new Error(
            'Google device code has expired. Please restart the authorization process.'
          )
          throw error
        }

        if (errorType === 'access_denied') {
          const error = new Error('Google authorization was denied by the user.')
          throw error
        }

        const error = new Error(
          `Google token polling failed: ${errorType} - ${tokenData.error_description || ''}`
        )
        throw error
      }

      const accessToken = tokenData.access_token || tokenData.accessToken
      const refreshToken = tokenData.refresh_token || tokenData.refreshToken
      const tokenExpiresIn = tokenData.expires_in || tokenData.expiresIn

      if (accessToken && refreshToken) {
        const expiresInSeconds = tokenExpiresIn || 3600
        const expiresAt = Date.now() + expiresInSeconds * 1000

        return {
          refreshToken,
          accessToken,
          expiresAt,
          email: tokenData.email || 'google-user@kiro.dev',
          region: effectiveRegion,
          authMethod: 'google'
        }
      }

      if (!tokenResponse.ok) {
        const error = new Error(
          `Google token request failed with status: ${tokenResponse.status} ${
            responseText ? `(${responseText.slice(0, 200)})` : ''
          }`
        )
        throw error
      }

      throw new Error(
        `Google token polling failed: missing tokens in response: ${responseText ? responseText.slice(0, 300) : '[empty]'}`
      )
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('expired') ||
          error.message.includes('denied') ||
          error.message.includes('failed'))
      ) {
        throw error
      }

      if (attempts >= maxAttempts) {
        const finalError = new Error(
          `Google token polling failed after ${attempts} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        throw finalError
      }
    }
  }

  const timeoutError = new Error('Google token polling timed out. Authorization may have expired.')
  throw timeoutError
}

export class GoogleAuthMethod {
  constructor(
    private config: any,
    private repository: AccountRepository,
    private accountManager: any
  ) {}

  async authorize(inputs?: Record<string, string>): Promise<AuthOuathResult> {
    const configuredServiceRegion: KiroRegion = this.config.default_region
    const oidcRegion: KiroRegion = normalizeRegion(inputs?.region || this.config.idc_region)

    logger.log('Google authorize: resolved defaults', {
      hasInputs: !!inputs && Object.keys(inputs).length > 0,
      oidcRegion
    })

    const auth = await authorizeKiroGoogle(oidcRegion)

    openBrowser(auth.verificationUrl)

    return {
      url: auth.verificationUrl,
      instructions: `Open the verification URL and complete Google sign-in.\nCode: ${auth.userCode}`,
      method: 'auto',
      callback: async (): Promise<{ type: 'success'; key: string } | { type: 'failed' }> => {
        try {
          const token = await pollKiroGoogleToken(
            auth.deviceCode,
            auth.interval,
            auth.expiresIn,
            oidcRegion
          )

          const serviceRegion = configuredServiceRegion
          let usage: any
          try {
            usage = await fetchUsageLimits({
              refresh: '',
              access: token.accessToken,
              expires: token.expiresAt,
              authMethod: 'google',
              region: serviceRegion,
              email: ''
            })
          } catch (e) {
            throw e
          }
          if (!usage.email) return { type: 'failed' }

          const id = createDeterministicAccountId(usage.email, 'google', undefined, undefined)
          const acc: ManagedAccount = {
            id,
            email: usage.email,
            authMethod: 'google',
            region: serviceRegion,
            oidcRegion,
            refreshToken: token.refreshToken,
            accessToken: token.accessToken,
            expiresAt: token.expiresAt,
            rateLimitResetTime: 0,
            isHealthy: true,
            failCount: 0,
            usedCount: usage.usedCount || 0,
            limitCount: usage.limitCount || 0
          }

          await this.repository.save(acc)
          this.accountManager?.addAccount?.(acc)

          return { type: 'success', key: token.accessToken }
        } catch (e: any) {
          const err = e instanceof Error ? e : new Error(String(e))
          logger.error('Google auth callback failed', err)
          throw new Error(
            `Google authorization failed: ${err.message}. Check ~/.config/opencode/kiro-logs/plugin.log for details.`
          )
        }
      }
    }
  }
}
