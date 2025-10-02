import dynamoose from 'dynamoose';
import { randomUUID } from 'crypto';

const FileDetails = {
  type: Object,
  required: true,
  schema: {
    name:        { type: String, required: true },
    filetype:    { type: String, required: true },
    size:        { type: Number, required: true },
    s3url:       { type: String, required: true }
  }
};

const ReqSchema = {
  type: Object,
  required: true,
  schema: {
    filedetails: FileDetails,
    params:      { type: Object },              // free-form per service
    service:     { type: String, required: true }
  }
};

const ExecutionStep = {
  type: Object,
  schema: {
    action: { type: String, required: true },
    params: { type: Object }                    // free-form step params
  }
};

const ThreadSchema = new dynamoose.Schema(
  {
    threadId:   { 
      type: String, 
      hashKey: true,
      default: () => randomUUID()
    },
    userId:    { 
      type: String, 
      required: true, 
      index: { 
        name: "userId-createdAt", 
        type: "global", 
        rangeKey: "createdAt" 
      } 
    },

    req:       ReqSchema,
    res:       { type: Object, default: {} },
    execution: { type: Array, schema: [ExecutionStep], default: [] },

  // createdAt and updatedAt are managed by the timestamps option below - do not declare them here
  ttl:       { type: Number, ttl: true }      // epoch seconds
  },
  { 
    saveUnknown: false, 
    timestamps: { 
      createdAt: "createdAt", 
      updatedAt: "updatedAt" 
    } 
  }
);

export const THREADS = dynamoose.model('Threads', ThreadSchema, {
  create: true,
  update: true,
  waitForActive: true,
});
