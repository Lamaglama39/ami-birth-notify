data "aws_partition" "current" {}
data "aws_region" "current" {}

resource "aws_imagebuilder_component" "example" {
  name     = "${var.app_name}-component"
  platform = "Linux"
  version  = "1.0.0"
  data     = <<EOF
name: example
description: Example component
schemaVersion: 1.0
phases:
  - name: build
    steps:
      - name: HelloWorld
        action: ExecuteBash
        inputs:
          commands:
            - echo Hello, Image Builder!
EOF
}

resource "aws_imagebuilder_image_recipe" "example" {
  name         = "${var.app_name}-recipe"
  version      = "1.0.0"
  parent_image = "arn:${data.aws_partition.current.partition}:imagebuilder:${data.aws_region.current.name}:aws:image/amazon-linux-2023-x86/x.x.x"
  component {
    component_arn = aws_imagebuilder_component.example.arn
  }
  block_device_mapping {
    device_name = "/dev/xvda"
    ebs {
      volume_size = 8
      volume_type = "gp3"
    }
  }
}

resource "aws_imagebuilder_infrastructure_configuration" "example" {
  name                          = "${var.app_name}-infra-config"
  instance_types                = ["t3.micro"]
  instance_profile_name         = aws_iam_instance_profile.ec2_instance_profile.name
  terminate_instance_on_failure = true
  sns_topic_arn                 = aws_sns_topic.image_builder_notifications.arn
}

resource "aws_imagebuilder_image_pipeline" "example" {
  name                             = "${var.app_name}-pipeline"
  image_recipe_arn                 = aws_imagebuilder_image_recipe.example.arn
  infrastructure_configuration_arn = aws_imagebuilder_infrastructure_configuration.example.arn

  schedule {
    schedule_expression                = "cron(* * * * ? *)"
    pipeline_execution_start_condition = "EXPRESSION_MATCH_AND_DEPENDENCY_UPDATES_AVAILABLE"
  }
  image_tests_configuration {
    image_tests_enabled = false
  }
  status = "ENABLED"
}

output "pipeline_execution" {
  value = "aws imagebuilder start-image-pipeline-execution --image-pipeline-arn ${aws_imagebuilder_image_pipeline.example.arn}"
}
