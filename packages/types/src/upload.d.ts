export type UploadStatus = 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED' | 'SUPERSEDED';
export interface UploadSummary {
    id: string;
    filename: string;
    fileHash: string;
    period: string | null;
    status: UploadStatus;
    rowCount: number;
    rebateCount: number;
    anomalyCount: number;
    parseErrorCount: number;
    createdAt: string;
    errorMessage: string | null;
}
export interface CreateUploadResponse {
    uploadId: string;
    status: UploadStatus;
    wasDuplicate: boolean;
}
