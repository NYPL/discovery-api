variable "alarm_sns_topic_arns" {
  type        = list(string)
  default     = ["arn:aws:sns:us-east-1:946183545209:DiscoveryApiErrorAlarm"]
  description = "SNS topics to notify when a log-based alarm fires"
}

locals {
  log_group_name = "/ecs/discovery-api-production"
}

# SCSB outage
resource "aws_cloudwatch_log_metric_filter" "scsb_outage" {
  log_group_name = local.log_group_name
  name           = "DiscoveryApiSCSBOutage"
  pattern        = "{ $.message = \"*SCSB*\" }"
  region         = "us-east-1"

  metric_transformation {
    name      = "DiscoveryApiSCSBOutage"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "scsb_outage" {
  alarm_name          = "DiscoveryApiSCSBOutageAlarm"
  alarm_description   = "SCSB errors logged by Discovery API, indicating possible SCSB outage."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.scsb_outage.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.scsb_outage.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

# Unhandled TypeErrors (shows up in stack)
resource "aws_cloudwatch_log_metric_filter" "type_error" {
  log_group_name = local.log_group_name
  name           = "DiscoveryApiTypeError"
  pattern        = "{ $.stack = \"TypeError*\" }"
  region         = "us-east-1"

  metric_transformation {
    name      = "DiscoveryApiTypeError"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "type_error" {
  alarm_name          = "DiscoveryApiTypeErrorAlarm"
  alarm_description   = "TypeErrors logged by Discovery API."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.type_error.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.type_error.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

# ES rejected execution (thread pool maxed out)
resource "aws_cloudwatch_log_metric_filter" "es_rejected_execution" {
  log_group_name = local.log_group_name
  name           = "DiscoveryApiESRejectedExecution"
  pattern        = "{ $.message = \"*es_rejected_execution_exception*\" }"
  region         = "us-east-1"

  metric_transformation {
    name      = "DiscoveryApiESRejectedExecution"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "es_rejected_execution" {
  alarm_name          = "DiscoveryApiESRejectedExecutionAlarm"
  alarm_description   = "ElasticSearch es_rejected_execution_exception logged by Discovery API, indicating the ES thread pool is exhausted."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.es_rejected_execution.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.es_rejected_execution.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

# ES request timeouts (elastic/transport TimeoutError sets name)
resource "aws_cloudwatch_log_metric_filter" "es_timeout" {
  log_group_name = local.log_group_name
  name           = "DiscoveryApiESTimeout"
  pattern        = "{ $.name = \"TimeoutError\" }"
  region         = "us-east-1"

  metric_transformation {
    name      = "DiscoveryApiESTimeout"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "es_timeout" {
  alarm_name          = "DiscoveryApiESTimeoutAlarm"
  alarm_description   = "ElasticSearch request timeouts logged by Discovery API."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.es_timeout.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.es_timeout.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}

# Catch-all for error-level logs not already covered by a more specific filter above

# Will remove once `apply`ed
import {
  to = aws_cloudwatch_log_metric_filter.log_error
  id = "/ecs/discovery-api-production:DiscoveryApiError"
}

import {
  to = aws_cloudwatch_metric_alarm.log_error
  id = "DiscoveryApiErrorAlarm"
}

resource "aws_cloudwatch_log_metric_filter" "log_error" {
  log_group_name = local.log_group_name
  name           = "DiscoveryApiError"
  pattern        = "{ ($.level = \"error\") && ($.message != \"*SCSB*\") && ($.stack != \"TypeError*\") && ($.message != \"*es_rejected_execution_exception*\") && ($.name != \"TimeoutError\") }"
  region         = "us-east-1"

  metric_transformation {
    name      = "DiscoveryApiError"
    namespace = "LogMetrics"
    unit      = "None"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "log_error" {
  alarm_name          = "DiscoveryApiErrorAlarm"
  alarm_description   = "Error-level logs from Discovery API not already covered by a more specific alarm."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = aws_cloudwatch_log_metric_filter.log_error.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.log_error.metric_transformation[0].namespace
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = var.alarm_sns_topic_arns
}
