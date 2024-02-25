import { publicSDK } from '@devrev/typescript-sdk';
// import * as gplay from 'google-play-scraper';
import { LLMUtils } from './llm_utils';
import { ApiUtils, HTTPResponse } from './utils';

export const run = async (events: any[]) => {
  for (const event of events) {
    const endpoint: string = event.execution_metadata.devrev_endpoint;
    const token: string = event.context.secrets.service_account_token;
    const fireWorksApiKey: string = event.input_data.keyrings.fireworks_api_key;
    const rapidApiKey: string = event.input_data.keyrings.rapid_api_key;
    const apiUtil: ApiUtils = new ApiUtils(endpoint, token);
    // Get the number of reviews to fetch from command args.
    const snapInId = event.context.snap_in_id;
    const devrevPAT = event.context.secrets.service_account_token;
    const baseURL = event.execution_metadata.devrev_endpoint;
    const inputs = event.input_data.global_values;
    let parameters: string = event.payload.parameters.trim();
    const tags = event.input_data.resources.tags;
    const llmUtil: LLMUtils = new LLMUtils(
      fireWorksApiKey,
      `accounts/fireworks/models/${inputs['llm_model_to_use']}`,
      200
    );
    const llmUtil2: LLMUtils = new LLMUtils(fireWorksApiKey, `accounts/fireworks/models/llamaguard-7b`, 200);
    let numReviews = 10;
    let commentID: string | undefined;
    if (parameters === 'help') {
      // Send a help message in CLI help format.
      const helpMessage = `twitter_tweets_process - Fetch tweets from Twitter(X.com) and create tickets in DevRev.\n\nUsage: /twitter_tweets_process <number_of_tweets_to_fetch>\n\n\`number_of_tweets_to_fetch\`: Number of tweets to fetch from Twitter (X.com). Should be a number between 1 and 50. If not specified, it defaults to 10.`;
      let postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, helpMessage, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      continue;
    }
    let postResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(
      snapInId,
      'Fetching tweets from Twitter(X.com). Please wait.',
      1
    );
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
      continue;
    }
    if (!parameters) {
      // Default to 10 reviews.
      parameters = '10';
    }
    // postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Helloooweoiwoeiwoie`, 1);
    try {
      numReviews = parseInt(parameters);

      if (!Number.isInteger(numReviews)) {
        throw new Error('Not a valid number');
      }
    } catch (err) {
      postResp = await apiUtil.postTextMessage(snapInId, 'Please enter a valid number', commentID);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      commentID = postResp.data.timeline_entry.id;
    }
    // Make sure number of reviews is <= 100.
    if (numReviews > 50) {
      postResp = await apiUtil.postTextMessage(snapInId, 'Please enter a number less than 50', commentID);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      commentID = postResp.data.timeline_entry.id;
    }
    // Get tweets from apiutil
    const twitterData = await apiUtil.queryTwitter(inputs['hashtag'], numReviews, rapidApiKey, snapInId);

    // check if the response is null
    if (!twitterData) {
      postResp = await apiUtil.postTextMessage(snapInId, 'No tweets found', commentID);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
      commentID = postResp.data.timeline_entry.id;
      continue;
    }

    // const tweetTexts: string[] = [];
    const results = twitterData.results; // Assuming 'results' is the key containing tweet objects

    // Post an update about the number of reviews fetched.
    postResp = await apiUtil.postTextMessageWithVisibilityTimeout(
      snapInId,
      `Fetched ${numReviews} tweets, creating tickets now.`,
      1
    );
    if (!postResp.success) {
      console.error(`Error while creating timeline entry: ${postResp.message}`);
      continue;
    }
    commentID = postResp.data.timeline_entry.id;

    //TODO: Counters
    let spamCounter = 0;
    let nsfwCounter = 0;
    let feedbackCounter = 0;
    let featureRequestCounter = 0;
    let bugCounter = 0;
    let cgCounter = 0;
    let duplicateCounter = 0;
    let questionCounter = 0;
    let SentimentTotal = 0;
    let bugList: String[] = [];
    let questionList: String[] = [];
    let feedbackList: String[] = [];
    let featureRequestList: String[] = [];

    // For each review, create a ticket in DevRev. -----> LOOP START
    for (let i = 0; i < results.length; i++) {
      let url = 'https://twitter.com/htTweets/status/' + results[i].tweet_id;
      let text = results[i].text;
      let title = 'Tweet from ' + results[i].user.username + ' using the hashtag ' + inputs['hashtag'];
      let imageurl = '';
      if (results.media_url.length > 0) {
        imageurl = results.media_url.join;
      }

      // Post a progress message saying creating ticket for review with review URL posted.
      postResp = await apiUtil.postTextMessageWithVisibilityTimeout(snapInId, `Creating ticket for review: ${url}`, 1);
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }

      // TODO: SPAM FILTERING
      let llmSpamResponse = {};
      const reviewSpamText = `Ticket created from X tweet ${url}\n\n${text}`;
      // const reviewSpamTitle = review.title || `Ticket created from X tweet ${url}`;
      const systemSpamPrompt = `You are an expert at Identifying Spam and NSFW reviews among tweets in Twitter. You are given a review provided by a user for the app ${inputs['app_id']}. You have to label the review as spam, nsfw or notspam. The output should be a JSON with fields "category" and "reason". The "category" field should be one of 'spam', 'nsfw' or 'notspam'. The 'reason' field should be a string explaining the reason for the category. \n\nReview: {review}\n\nOutput:`;
      const humanSpamPrompt = '';
      try {
        llmSpamResponse = await llmUtil2.chatCompletion(systemSpamPrompt, humanSpamPrompt, {
          review: reviewSpamText ? reviewSpamText : 'No review found',
        });
        console.log(`LLM Response: ${JSON.stringify(llmSpamResponse)}`);
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }
      let inferredspam = 'notspam';
      if ('category' in llmSpamResponse) {
        inferredspam = llmSpamResponse['category'] as string;
      }
      if (inferredspam === 'spam') {
        spamCounter++;
        console.log(`Review is spam. Skipping ticket creation.`);
        continue;
      } else if (inferredspam === 'nsfw') {
        nsfwCounter++;
        console.log(`Review is NSFW. Skipping ticket creation.`);
        continue;
      }
      // TODO: Identify computer generated reviews
      // let cgResponse: number = 0;
      try {
        const cgResponse: number = await apiUtil.predictText(text);
        if (cgResponse > 0.8) {
          cgCounter++;
          console.log(`Review is computer generated. Skipping ticket creation.`);
          continue;
        }
      } catch (err) {
        console.log(err);
      }

      const reviewText = `Ticket created from Twitter tweet review ${url}\n\n${text}`;
      // const reviewTitle = review.title || `Ticket created from Playstore review ${url}`;
      // const reviewID = review.id;
      const systemPrompt = `You are an expert at labelling a given Tweet from twitter as bug, feature_request, question or feedback. You are given a review provided by a user for the app ${inputs['app_id']}. You have to label the review as bug, feature_request, question or feedback. The output should be a JSON with fields "category", "summary" and "reason". The "category" field should be one of "bug", "feature_request", "question" or "feedback". The "summary" field should be a string summarizing the reviewin 20 words. The "reason" field should be a string explaining the reason for the category. \n\nReview: {review}\n\nOutput:`;
      const humanPrompt = ``;

      let llmResponse = {};
      try {
        llmResponse = await llmUtil.chatCompletion(systemPrompt, humanPrompt, {
          review: reviewText ? reviewText : 'No review found',
        });
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }
      let tagsToApply = [];
      let inferredCategory = 'failed_to_infer_category';
      if ('category' in llmResponse) {
        inferredCategory = llmResponse['category'] as string;
        if (!(inferredCategory in tags)) {
          inferredCategory = 'failed_to_infer_category';
        }
      }

      let reviewSummary = '';
      let reviewReason = '';
      if ('summary' in llmResponse) {
        reviewSummary = llmResponse['summary'] as string;
        if (!(inferredCategory in tags)) {
          reviewSummary = '';
        } else if (inferredCategory == 'bug') {
          bugCounter++;
          bugList.push(reviewSummary);
        } else if (inferredCategory == 'question') {
          questionCounter++;
          questionList.push(reviewSummary);
        } else if (inferredCategory == 'feature_request') {
          featureRequestCounter++;
          featureRequestList.push(reviewSummary);
        } else if (inferredCategory == 'feedback') {
          feedbackCounter++;
          feedbackList.push(reviewSummary);
        }
      }
      if ('reason' in llmResponse) {
        reviewReason = llmResponse['reason'] as string;
        if (!(inferredCategory in tags)) {
          reviewReason = '';
        }
      }

      // If we failed to infer the category, skip the ticket creation.
      if (inferredCategory === 'failed_to_infer_category') {
        postResp = await apiUtil.postTextMessageWithVisibilityTimeout(
          snapInId,
          `The tweet doesn't fit in any of the categories. ${url}. Skipping ticket creation.`,
          1
        );
        if (!postResp.success) {
          console.error(`Error while creating timeline entry: ${postResp.message}`);
          continue;
        }
        continue;
      }

      // TODO: Duplicates should be avoided.

      let summaryQuery = '';
      let llmQuery = '';
      if (inferredCategory == 'bug') {
        summaryQuery = bugList.length === 0 ? '' : bugList.join('');
        llmQuery =
          "You are an expert in understanding and summarising bug reports. You are given a list of summaries and a bug reported by customer. Please answer in json format with a field 'answer'. 'answer' should be just a single number 0 if a similar bug report does not exists in the list, or a 1 if a similar bug report exists in the list. Return 0 if the summaries list is empty";
      } else if (inferredCategory == 'question') {
        summaryQuery = questionList.length === 0 ? '' : questionList.join('');
        llmQuery =
          "You are an expert in understanding customer questions. You are given a list of summaries and a customer question. Please answer in json format with a field 'answer'. 'answer' should be just a single number 0 if a similar customer question does not exists in the list, or a 1 if a similar customer question exists in the list. Return 0 if the summaries list is empty";
      } else if (inferredCategory == 'feedback') {
        summaryQuery = feedbackList.length === 0 ? '' : feedbackList.join('');
        llmQuery =
          "You are an expert in understanding customer feedback. You are given a list of feedback summaries and a customer feedback. Please answer in json format with a field 'answer'. 'answer' should be just a single number 0 if a similar customer feedback does not exists in the list, or a 1 if a similar customer feedback exists in the list. Return 0 if the summaries list is empty";
      } else {
        summaryQuery = featureRequestList.length === 0 ? '' : featureRequestList.join('');
        llmQuery =
          "You are an expert in understanding techical feature requests. You are given a list of feature request summaries and a customer feature request. Please answer in json format with a field 'answer'. 'answer' should be just a single number 0 if a similar customer feature request does not exists in the list, or a 1 if a similar customer feature request exists in the list. Return 0 if the summaries list is empty";
      }

      let llmSummaryResponse = {};
      try {
        llmSummaryResponse = await llmUtil.chatCompletion(
          `Known Summaries: ${summaryQuery}, query: ${reviewText}\n\n\nSummary: {review}\n\nOutput:`,
          llmQuery,
          {
            review: reviewText ? reviewText : 'No review found',
          }
        );
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      let summarySol = 0;
      if ('answer' in llmSummaryResponse) {
        try {
          summarySol = llmSummaryResponse['answer'] as number;
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }
      }

      if (summarySol == 1) {
        duplicateCounter++;
        postResp = await apiUtil.postTextMessageWithVisibilityTimeout(
          snapInId,
          `Similar issue already flagged in DevRev of {review}. Skipping ticket creation.`,
          1
        );
        if (!postResp.success) {
          console.error(`Error while creating timeline entry: ${postResp.message}`);
          continue;
        }
        continue;
      }

      // TODO: Business Impact for Bugs

      if (inferredCategory === 'bug') {
        let SentimentScore = 0;
        let llmFeedbackResponse = {};
        try {
          llmFeedbackResponse = await apiUtil.askSentiment(reviewText, rapidApiKey);
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }

        let feedbackSentiment = '';
        if ('type' in llmFeedbackResponse) {
          feedbackSentiment = llmFeedbackResponse['type'] as string;
        }
        if ('score' in llmFeedbackResponse) {
          SentimentScore = llmFeedbackResponse['score'] as number;
          SentimentTotal += SentimentScore;
        }
        let llmBugResponse = {};
        const reviewBugText = `Summary: ${reviewSummary}\n\nReason: ${reviewReason}\n\nBug text: ${text}`;
        // const reviewBugTitle = review.title || `Ticket created from Playstore review ${review.url}`;
        const systemBugPrompt = `You are an expert at understanding the business impact of a bug. You are given a review provided by a user for the app ${inputs['app_id']}. The output should be a JSON with fields "impact" and "severity". The "impact" field should have a explanation in under 40 words. The "severity" field should be a single number between 0 and 10. \n\nReview: {review}\n\nOutput:`;
        const humanBugPrompt = '';
        try {
          llmSpamResponse = await llmUtil.chatCompletion(systemBugPrompt, humanBugPrompt, {
            review: reviewBugText ? reviewBugText : 'No review found',
          });
          console.log(`LLM Response: ${JSON.stringify(llmBugResponse)}`);
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }

        let bugImpact = '';
        let bugSeverity = 0;
        if ('impact' in llmBugResponse) {
          bugImpact = llmBugResponse['impact'] as string;
        }
        try {
          if ('severity' in llmBugResponse) {
            bugSeverity = llmBugResponse['severity'] as number;
          }
        } catch (err) {
          console.error(`Error while Parsing Severity: ${err}`);
        }

        // Create a ticket with title as review title and description as review text.
        const createTicketResp = await apiUtil.createTicket({
          title: title,
          tags: [
            { id: tags[inferredCategory].id },
            { id: tags['Twitter'].id },
            SentimentScore > 0 ? { id: tags['Positive'].id } : { id: tags['Negative'].id },
          ],
          body:
            reviewText +
            '\n\n' +
            bugImpact +
            '\n\n Bug severity: ' +
            bugSeverity.toString() +
            '\n\n Feedback Sentiment: ' +
            feedbackSentiment +
            '\n\n' +
            (imageurl == '')
              ? ''
              : '\n\nlinked image ' + imageurl,
          type: publicSDK.WorkType.Ticket,
          owned_by: [inputs['default_owner_id']],
          applies_to_part: inputs['default_part_id'],
        });
        if (!createTicketResp.success) {
          console.error(`Error while creating ticket: ${createTicketResp.message}`);
          continue;
        }
        // Post a message with ticket ID.
        const ticketID = createTicketResp.data.work.id;
        const ticketCreatedMessage = `Created ticket: <${ticketID}> and it is categorized as ${inferredCategory}`;
        const postTicketResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(
          snapInId,
          ticketCreatedMessage,
          1
        );
        if (!postTicketResp.success) {
          console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
          continue;
        }
        continue;
      }

      // TODO: Business impact for feature_request

      if (inferredCategory === 'feature_request') {
        let SentimentScore = 0;
        let llmFeedbackResponse = {};
        try {
          llmFeedbackResponse = await apiUtil.askSentiment(reviewText, rapidApiKey);
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }

        let feedbackSentiment = '';
        if ('type' in llmFeedbackResponse) {
          feedbackSentiment = llmFeedbackResponse['type'] as string;
        }
        if ('score' in llmFeedbackResponse) {
          SentimentScore = llmFeedbackResponse['score'] as number;
          SentimentTotal += SentimentScore;
        }
        let llmFeatureResponse = {};
        const reviewFeatureText = `Summary: ${reviewSummary}\n\nReason: ${reviewReason}\n\nFeature request: ${text}`;
        const reviewFeatureTitle = title;
        const systemFeaturePrompt = `You are an expert at understanding the business impact of a feature request. You are given a review provided by a user for the app ${inputs['app_id']}. The output should be a JSON with fields "impact" and "severity". The "impact" field should have a explanation in under 40 words. The "severity" field should be a single number between 0 and 10. \n\nReview: {review}\n\nOutput:`;
        const humanFeaturePrompt = '';
        try {
          llmFeatureResponse = await llmUtil.chatCompletion(systemFeaturePrompt, humanFeaturePrompt, {
            review: reviewFeatureTitle ? reviewFeatureTitle + '\n' + reviewFeatureText : reviewFeatureText,
          });
          console.log(`LLM Response: ${JSON.stringify(llmFeatureResponse)}`);
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }

        let featureImpact = '';
        let featureSeverity = 0;
        if ('impact' in llmFeatureResponse) {
          featureImpact = llmFeatureResponse['impact'] as string;
        }
        try {
          if ('severity' in llmFeatureResponse) {
            featureSeverity = llmFeatureResponse['severity'] as number;
          }
        } catch (err) {
          console.error(`Error while Parsing Severity: ${err}`);
        }

        // Create a ticket with title as review title and description as review text.
        const createTicketResp = await apiUtil.createTicket({
          title: title,
          tags: [
            { id: tags[inferredCategory].id },
            { id: tags['Twitter'].id },
            SentimentScore > 0 ? { id: tags['Positive'].id } : { id: tags['Negative'].id },
          ],
          body:
            reviewText + '\n\n' + featureImpact + '\n\n Bug severity: ' + featureSeverity.toString() + (imageurl == '')
              ? ''
              : '\n\nlinked image ' + imageurl,
          type: publicSDK.WorkType.Ticket,
          owned_by: [inputs['default_owner_id']],
          applies_to_part: inputs['default_part_id'],
        });
        if (!createTicketResp.success) {
          console.error(`Error while creating ticket: ${createTicketResp.message}`);
          continue;
        }
        // Post a message with ticket ID.
        const ticketID = createTicketResp.data.work.id;
        const ticketCreatedMessage = `Created ticket: <${ticketID}> and it is categorized as ${inferredCategory}`;
        const postTicketResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(
          snapInId,
          ticketCreatedMessage,
          1
        );
        if (!postTicketResp.success) {
          console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
          continue;
        }
        continue;
      }

      // TODO: Sentiment analysis for feedback ticket.

      if (inferredCategory === 'feedback') {
        let SentimentScore = 0;
        let llmFeedbackResponse = {};
        try {
          llmFeedbackResponse = await apiUtil.askSentiment(reviewText, rapidApiKey);
        } catch (err) {
          console.error(`Error while calling LLM: ${err}`);
        }

        let feedbackSentiment = '';
        if ('type' in llmFeedbackResponse) {
          feedbackSentiment = llmFeedbackResponse['type'] as string;
        }
        if ('score' in llmFeedbackResponse) {
          SentimentScore = llmFeedbackResponse['score'] as number;
          SentimentTotal += SentimentScore;
        }

        // Create a ticket with title as review title and description as review text.
        const createTicketResp = await apiUtil.createTicket({
          title: title,
          tags: [
            { id: tags[inferredCategory].id },
            { id: tags['Twitter'].id },
            SentimentScore > 0 ? { id: tags['Positive'].id } : { id: tags['Negative'].id },
          ],
          body:
            'Tweet: ' +
            text +
            'Review Summary: ' +
            reviewSummary +
            '\n\n Feedback Sentiment: ' +
            feedbackSentiment.toString() +
            '\n\n Sentiment Score: ' +
            SentimentScore.toString() +
            (imageurl == '')
              ? ''
              : '\n\nlinked image ' + imageurl,
          type: publicSDK.WorkType.Ticket,
          owned_by: [inputs['default_owner_id']],
          applies_to_part: inputs['default_part_id'],
        });
        if (!createTicketResp.success) {
          console.error(`Error while creating ticket: ${createTicketResp.message}`);
          continue;
        }
        // Post a message with ticket ID.
        const ticketID = createTicketResp.data.work.id;
        const ticketCreatedMessage = `Created ticket: <${ticketID}> and it is categorized as ${inferredCategory}`;
        const postTicketResp: HTTPResponse = await apiUtil.postTextMessageWithVisibilityTimeout(
          snapInId,
          ticketCreatedMessage,
          1
        );
        if (!postTicketResp.success) {
          console.error(`Error while creating timeline entry: ${postTicketResp.message}`);
          continue;
        }
        continue;
      }
    }
    // TODO: Sentiment trend analysis for all feedback
    if (feedbackCounter > 0) {
      postResp = await apiUtil.postTextMessage(
        snapInId,
        `Overall Customer Sentiment Score: ${
          SentimentTotal / feedbackCounter
        } \n (Negative = -1, Neutral = 0, Positive = 1)`
      );
      if (!postResp.success) {
        console.error(`Error while creating timeline entry: ${postResp.message}`);
        continue;
      }
    }

    // TODO: Best in each category
    if (featureRequestList.length > 0) {
      let topFeatureRequest = {};
      const systemFeedbackPrompt = `You are an expert at understanding feature requests. You are given a list of feature request summaries provided by a user for the app ${inputs['app_id']}. The output should be a JSON with field "answer". The "answer" field should have an explanation of the top requested feature in less than 50 words. \n\nReview: {review}\n\nOutput:`;
      const humanFeedbackPrompt = '';
      try {
        topFeatureRequest = await llmUtil.chatCompletion(systemFeedbackPrompt, humanFeedbackPrompt, {
          review: featureRequestList.join('\n\n'),
        });
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      if ('answer' in topFeatureRequest) {
        const topFeatureDescription = topFeatureRequest['answer'] as string;
        const postFeatureResp = await apiUtil.postTextMessage(
          snapInId,
          'Top requested feature: ' + topFeatureDescription
        );
        if (!postFeatureResp.success) {
          console.error(`Error while creating timeline entry: ${postFeatureResp.message}`);
        }
      }
    } else {
      console.log('No feature requests found');
    }

    if (bugList.length > 0) {
      let topBug = {};
      const systemFeedbackPrompt = `You are an expert at understanding the reported bugs. You are given a list of bug summaries provided by a user for the app ${inputs['app_id']}. The output should be a JSON with field "answer". The "answer" field should have an explanation of the top reported bug in less than 50 words. \n\nReview: {review}\n\nOutput:`;
      const humanFeedbackPrompt = '';
      try {
        topBug = await llmUtil.chatCompletion(systemFeedbackPrompt, humanFeedbackPrompt, {
          review: bugList.join('\n\n'),
        });
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      if ('answer' in topBug) {
        const topBugDescription = topBug['answer'] as string;
        const postBugResp = await apiUtil.postTextMessage(snapInId, 'Top reported bug: ' + topBugDescription);
        if (!postBugResp.success) {
          console.error(`Error while creating timeline entry: ${postBugResp.message}`);
        }
      }
    } else {
      console.log('No bug found');
    }

    if (feedbackList.length > 0) {
      let overallFeedback = {};
      const systemFeedbackPrompt = `You are an expert at understanding the customer feedback. You are given a list of feedback summaries provided by a user for the app ${inputs['app_id']}. The output should be a JSON with field "answer". The "answer" field should have a explanation of the best/top feedback of the customer in less than 50 words.  \n\nReview: {review}\n\nOutput:`;
      const humanFeedbackPrompt = '';
      try {
        overallFeedback = await llmUtil.chatCompletion(systemFeedbackPrompt, humanFeedbackPrompt, {
          review: feedbackList.join('\n\n'),
        });
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      if ('answer' in overallFeedback) {
        const sentiment = overallFeedback['answer'] as string;
        const postFeedbackResp = await apiUtil.postTextMessage(snapInId, 'Top customer feedback: ' + sentiment);
        if (!postFeedbackResp.success) {
          console.error(`Error while creating timeline entry: ${postFeedbackResp.message}`);
        }
      }
    } else {
      console.log('No feedback found');
    }

    // TODO: Identifying customer knowledge gaps only if there are questions.
    if (questionList.length > 0) {
      let overallSentiment = {};

      const systemSentimentPrompt = `You are an expert at understanding the business intracies and filling customer knowlegde gaps. You are given a list of questions provided by a user for the app ${inputs['app_id']}. The output should be a JSON with field "answer". The "answer" field should have a explanation of the knowledge gaps of the customer in less than 50 words.  \n\nReview: {review}\n\nOutput:`;
      const humanSentimentPrompt = '';
      try {
        overallSentiment = await llmUtil.chatCompletion(systemSentimentPrompt, humanSentimentPrompt, {
          review: questionList.join('\n'),
        });
      } catch (err) {
        console.error(`Error while calling LLM: ${err}`);
      }

      if ('answer' in overallSentiment) {
        const sentiment = overallSentiment['answer'] as string;
        const postSentimentResp = await apiUtil.postTextMessage(snapInId, 'Overall Sentiment: ' + sentiment);
        if (!postSentimentResp.success) {
          console.error(`Error while creating timeline entry: ${postSentimentResp.message}`);
        }
      }
    } else {
      console.log('No questions found');
    }

    // postResp the counters
    postResp = await apiUtil.postTextMessage(
      snapInId,
      `Spam reviews: ${spamCounter}\nNSFW reviews: ${nsfwCounter}\nDuplicate reviews: ${duplicateCounter}\nAI reviews detected: ${cgCounter}`
    );
    postResp = await apiUtil.postTextMessage(
      snapInId,
      `Total feedback: ${feedbackCounter} \n Total bugs: ${bugCounter} \n Total feature Requests: ${featureRequestCounter} \n Total questions: ${questionCounter}`
    );
  }
};

export default run;
