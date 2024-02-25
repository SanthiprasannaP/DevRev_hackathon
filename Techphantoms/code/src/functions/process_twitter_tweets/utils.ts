import { client, publicSDK } from '@devrev/typescript-sdk';
import { AxiosResponse } from 'axios';

export type HTTPResponse = {
  success: boolean;
  message: string;
  data: any;
};

export const defaultResponse: HTTPResponse = {
  data: {},
  message: '',
  success: false,
};

export class ApiUtils {
  public devrevSdk!: publicSDK.Api<HTTPResponse>;

  // Constructor to initialize SDK instances
  constructor(endpoint: string, token: string) {
    this.devrevSdk = client.setup({
      endpoint: endpoint,
      token: token,
    });
  }

  // Create a timeline entry
  async createTimeLine(payload: publicSDK.TimelineEntriesCreateRequest): Promise<HTTPResponse> {
    try {
      const response: AxiosResponse = await this.devrevSdk.timelineEntriesCreate(payload);
      return { data: response.data, message: 'Timeline created successfully', success: true };
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to create timeline. Err: ${JSON.stringify(error.response.data)}, Status: ${
          error.response.status
        }`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }

  // Create a ticket
  async createTicket(payload: publicSDK.WorksCreateRequest): Promise<HTTPResponse> {
    try {
      const response: AxiosResponse = await this.devrevSdk.worksCreate(payload);
      return { data: response.data, message: 'Ticket created successfully', success: true };
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to create ticket. Err: ${JSON.stringify(error.response.data)}, Status: ${
          error.response.status
        }`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }

  // Update a timeline entry
  async updateTimeLine(payload: publicSDK.TimelineEntriesUpdateRequest): Promise<HTTPResponse> {
    try {
      const response: AxiosResponse = await this.devrevSdk.timelineEntriesUpdate(payload);
      return { data: response.data, message: 'Timeline updated successfully', success: true };
    } catch (error: any) {
      if (error.response) {
        const err = `Failed to update timeline. Err: ${JSON.stringify(error.response.data)}, Status: ${
          error.response.status
        }`;
        return { ...defaultResponse, message: err };
      } else {
        return { ...defaultResponse, message: error.message };
      }
    }
  }

  async postTextMessage(snapInId: string, message: string, commentID?: string) {
    if (!commentID) {
      // Create a new comment.
      const createPayload: publicSDK.TimelineEntriesCreateRequest = {
        body: message,
        body_type: publicSDK.TimelineCommentBodyType.Text,
        object: snapInId,
        type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
        visibility: publicSDK.TimelineEntryVisibility.Internal,
      };

      const createTimelineResponse: HTTPResponse = await this.createTimeLine(createPayload);
      return createTimelineResponse;
    }
    // Update it instead.
    const updatePayload: publicSDK.TimelineEntriesUpdateRequest = {
      body: message,
      id: commentID,
      type: publicSDK.TimelineEntriesUpdateRequestType.TimelineComment,
    };
    const updateTimelineResponse: HTTPResponse = await this.updateTimeLine(updatePayload);
    return updateTimelineResponse;
  }

  async postTextMessageWithVisibilityTimeout(snapInId: string, message: string, expiresInMins: number) {
    // Create a new comment.
    const createPayload: publicSDK.TimelineEntriesCreateRequest = {
      expires_at: new Date(Date.now() + expiresInMins * 60000).toISOString(),
      body: message,
      body_type: publicSDK.TimelineCommentBodyType.Text,
      object: snapInId,
      type: publicSDK.TimelineEntriesCreateRequestType.TimelineComment,
      visibility: publicSDK.TimelineEntryVisibility.Internal,
    };

    const createTimelineResponse: HTTPResponse = await this.createTimeLine(createPayload);
    return createTimelineResponse;
  }

  async askSentiment(message: string, rapidApiKey: string) {
    const encodedMessage = encodeURIComponent(message);
    const url = `https://twinword-sentiment-analysis.p.rapidapi.com/analyze/?text=${encodedMessage}`;
    const options = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'twinword-sentiment-analysis.p.rapidapi.com',
      },
    };

    try {
      const response = await fetch(url, options);
      const result = await response.text();
      return JSON.parse(result);
    } catch (error) {
      console.error(error);
    }
  }

  async queryTwitter(hashtag: string, limit: number, rapidapiKey: string, snapID: string) {
    const url: string = `https://twitter154.p.rapidapi.com/hashtag/hashtag?hashtag=%23${encodeURIComponent(
      hashtag
    )}&limit=${limit}&section=top`;
    const options: RequestInit = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidapiKey,
        'X-RapidAPI-Host': 'twitter154.p.rapidapi.com',
      },
    };

    try {
      const response: Response = await fetch(url, options);
      const result: string = await response.text();
      console.log(result);
      return JSON.parse(result);
    } catch (error) {
      this.postTextMessageWithVisibilityTimeout(snapID, `Failed to query Twitter. Error: ${error}`, 1);
    }
  }
  async predictText(document: string): Promise<number> {
    const url: string = 'https://api.gptzero.me/v2/predict/text';
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'x-api-key': '',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ document, version: '2024-01-09' }),
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      console.log(data);
      let jsondata = JSON.parse(data);
      return jsondata.documents[0].class_probabilities.ai;
    } catch (error) {
      console.error(error);
      // Return a default value or throw an error based on your requirement
      return -1; // Default value indicating error
    }
  }
}
