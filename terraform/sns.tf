# SNS トピックの作成
resource "aws_sns_topic" "image_builder_notifications" {
  name = "${var.app_name}-image-builder-notifications"
}

# SNS サブスクリプション（Lambda 関数）
resource "aws_sns_topic_subscription" "lambda_subscription" {
  topic_arn = aws_sns_topic.image_builder_notifications.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.notify_slack.arn
}
