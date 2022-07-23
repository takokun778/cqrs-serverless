package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	av "github.com/aws/aws-sdk-go-v2/feature/dynamodb/attributevalue"
	"github.com/aws/aws-sdk-go-v2/service/dynamodb"
)

var (
	client *dynamodb.Client
	table  string
)

func init() {
	cfg, err := config.LoadDefaultConfig(context.TODO())

	if err != nil {
		log.Fatalln(err.Error())
	}

	client = dynamodb.NewFromConfig(cfg)

	if os.Getenv("DYNAMODB_TABLE_NAME") == "" {
		log.Fatalln("DynamoDB table name is empty")
	}

	table = os.Getenv("DYNAMODB_TABLE_NAME")
}

type Body struct {
	Events []Event `json:"events"`
}

type Event struct {
	ID        string `json:"id"`
	Key       string `json:"key"`
	Value     string `json:"value"`
	CreatedAt int    `json:"createdAt"`
}

func Handle(ctx context.Context, req events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	input := &dynamodb.ScanInput{
		TableName: aws.String(table),
		Limit:     aws.Int32(100),
	}

	output, err := client.Scan(ctx, input)

	if err != nil {
		return events.APIGatewayProxyResponse{}, err
	}

	result := make([]Event, 0, output.ScannedCount)

	for _, item := range output.Items {
		event := Event{}

		if err := av.UnmarshalMap(item, &event); err != nil {
			return events.APIGatewayProxyResponse{}, err
		}

		result = append(result, event)
	}

	resBody, err := json.Marshal(Body{
		Events: result,
	})
	if err != nil {
		return events.APIGatewayProxyResponse{
			StatusCode: http.StatusInternalServerError,
		}, err
	}

	return events.APIGatewayProxyResponse{
		StatusCode: http.StatusOK,
		Body:       string(resBody),
	}, nil
}

func main() {
	lambda.Start(Handle)
}
