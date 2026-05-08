interface UnifiedImage {
    mediaType: string;
    data: string;
}
interface KiroImage {
    format: string;
    source: {
        bytes: string;
    };
}
export declare function extractAllImages(content: any): UnifiedImage[];
export declare function convertImagesToKiroFormat(images: UnifiedImage[]): KiroImage[];
export declare function extractTextFromParts(parts: any[]): string;
export {};
