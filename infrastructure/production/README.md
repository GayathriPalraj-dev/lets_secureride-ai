# SecureRide Lambda production infrastructure

`main.yaml` is the active free-focused deployment design. It uses private S3
buckets, CloudFront, an API Gateway HTTP API, and a Node.js 24 x86-64 Lambda.
The files under `infrastructure/nginx/` and `infrastructure/systemd/` are
historical EC2 references and are not used by this stack.

Deployment remains a separately approved operation. Before any AWS mutation:

1. Run the complete local checks and the explicit database index-verification
   commands. Lambda initialization never creates or verifies indexes.
2. Create the Lambda ZIP with `package-lambda.ps1` on a machine that already has
   Docker. The script builds only in the official Node.js 24 Lambda image for
   linux/amd64 and prints the image digest and ZIP SHA-256.
3. Confirm the existing SSM Standard SecureString JSON is valid, contains only
   approved keys, is at most 3,800 UTF-8 bytes, and has the expected HTTPS
   CloudFront origin. Never put its value in CloudFormation parameters.
4. Upload the immutable ZIP under a content-addressed key and record its S3
   version ID.
5. Run local template validation, then obtain separate approval before official
   AWS validation or change-set creation.
6. Review the change set, cost controls, IAM scope, retained buckets, and Atlas
   exposure before deployment.
7. After deployment, verify exact health endpoints, authentication/RBAC, all six
   cars, booking, coupons, payment options, Stripe raw-body verification, image
   scan HMAC verification, and image delivery.

Rollback uses the previous Lambda artifact version, previous SSM parameter
version, and previous CloudFront configuration. Retained S3 objects and
CloudWatch logs require an explicit cleanup review because they can incur cost.
