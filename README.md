# DevRev_hackathon
Hackathon

Our project aims to harness the power of AI and data analytics to extract actionable insights from customer reviews across various channels including the App Store, Play Store, and Twitter. By utilizing advanced natural language processing (NLP) models and sophisticated algorithms, we strive to provide businesses with valuable insights to improve their products, services, and customer satisfaction.

Key Features
Multi-Channel Data Ingestion: Ingest reviews from the App Store, Play Store, and Twitter, ensuring a comprehensive view of customer feedback.
Initial Filtration: Identify duplicate reviews and categorize them as AI-generated or human-generated using GPT Zero. Determine spam and NSFW content using Llama Guard 7B.
Review Segmentation: Segment reviews into feedback, feature requests, bugs, or questions using Llama Mixtral 8X 7B.
Sentiment Analysis: Perform sentiment analysis on feedback to categorize them into positive, neutral, and negative classes using Rapid API.
Feature Importance Analysis: Analyze feature requests to determine the importance of each feature and assess its business impact.
Bug Severity Analysis: Identify the severity of bugs, their potential benefits if resolved, and provide suggestions for fixing them.
Customer Knowledge Gap Analysis: Analyze questions to identify areas where there is a customer knowledge gap.
Twitter Engagement Metric: Calculate user engagement metrics like reach based on public metrics such as retweet count, reply count, like count, etc., specifically for the Twitter channel.
Implementation Details
Data Ingestion: Utilize DevRev APIs to collect reviews from different channels in real-time.
NLP and AI Models: Implement advanced NLP models like GPT Zero, Llama Guard 7B, and Llama Mixtral 8X 7B for initial filtration, review segmentation, and sentiment analysis.
Sentiment Analysis: Integrate with Rapid API to perform sentiment analysis on feedback.
Our project aims to provide businesses with actionable insights derived from customer reviews across multiple channels. By leveraging AI and data analytics, we enable organizations to make informed decisions, prioritize tasks, and enhance customer satisfaction.
