package main

import (
	"context"
	"log"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

// var client *s3.Client

// func init() {
// 	cfg, err := config.LoadDefaultConfig(context.TODO())

// 	if err != nil {
// 		log.Fatalln(err.Error())
// 	}

// 	client = s3.NewFromConfig(cfg)
// }

func Handle(ctx context.Context, event events.DynamoDBEvent) error {
	for _, record := range event.Records {
		log.Println(record)

		if record.EventName != "INSERT" {
			continue
		}

		// param := &s3.PutObjectInput{
		// 	Bucket:                  aws.String(""),
		// 	Key:                     aws.String(""),
		// 	Body:                    strings.NewReader(""),
		// 	WebsiteRedirectLocation: aws.String(""),
		// }

		log.Printf("record: %+v\n", record)

		command := record.Change.NewImage[""]

		log.Printf("command: %+v\n", command)

		// if _, err := client.PutObject(ctx, param); err != nil {
		// 	return err
		// }
	}

	return nil
}

func main() {
	lambda.Start(Handle)
}
