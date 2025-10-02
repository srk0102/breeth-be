import { WrapperService } from "./dynamoService";
import { S3Service } from "./s3Service";
import { ProcessingService } from "./processingService";
import { TranscriptionService } from "./transcriptionService";

import { THREADS } from "../models";

export { S3Service, ProcessingService, TranscriptionService };

export const QueueService = WrapperService(THREADS);
