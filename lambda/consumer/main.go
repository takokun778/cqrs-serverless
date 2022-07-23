package main

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var (
	client *s3.Client
	bucket string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())

	if err != nil {
		log.Fatalln(err.Error())
	}

	client = s3.NewFromConfig(cfg)

	if os.Getenv("S3_BUCKET_NAME") == "" {
		log.Fatalln("bucket name is empty")
	}

	bucket = os.Getenv("S3_BUCKET_NAME")
}

func Handle(ctx context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		log.Println(record)

		if record.EventName != "INSERT" {
			continue
		}

		log.Printf("record: %+v\n", record)

		id := record.Change.NewImage["id"].String()

		command := record.Change.NewImage["command"].String()

		key := record.Change.NewImage["key"].String()

		value := record.Change.NewImage["value"].String()

		log.Printf("command: %s\n", command)

		switch command {
		case "create", "update":
			param := &s3.PutObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(key),
				Body:   strings.NewReader(""),
				Metadata: map[string]string{
					"value": value,
				},
			}

			if _, err := client.PutObject(ctx, param); err != nil {
				log.Println(err.Error())

				continue
			}
		case "delete":
			param := &s3.DeleteObjectInput{
				Bucket: aws.String(bucket),
				Key:    aws.String(key),
			}

			if _, err := client.DeleteObject(ctx, param); err != nil {
				log.Println(err.Error())

				continue
			}
		default:
			log.Printf("id: %s\n", id)
		}
	}

	return nil
}

func main() {
	lambda.Start(Handle)
}
