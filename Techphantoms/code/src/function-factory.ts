import process_appstore_reviews from './functions/process_appstore_reviews';
import process_playstore_reviews from './functions/process_playstore_reviews';
import process_twitter_tweets from './functions/process_twitter_tweets';

export const functionFactory = {
  process_playstore_reviews,
  process_twitter_tweets,
  process_appstore_reviews,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
