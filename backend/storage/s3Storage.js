let cachedClient = null;

async function getS3Client() {
  if (cachedClient) {
    return cachedClient;
  }

  try {
    const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    cachedClient = {
      client,
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
    };
    return cachedClient;
  } catch (error) {
    throw new Error(
      'Failed to load @aws-sdk/client-s3. Install the package in backend/ and ensure credentials are configured.'
    );
  }
}

export async function saveObjectToS3({ key, buffer, contentType = 'application/octet-stream' }) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET is not configured');
  }

  const { client, PutObjectCommand } = await getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  const baseUrl = process.env.S3_BASE_URL || `https://${bucket}.s3.amazonaws.com/${key}`;
  return { key, location: baseUrl };
}

export async function readObjectFromS3(key) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET is not configured');
  }

  const { client, GetObjectCommand } = await getS3Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await client.send(command);
  if (response.Body?.transformToByteArray) {
    const arr = await response.Body.transformToByteArray();
    return Buffer.from(arr);
  }

  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteObjectFromS3(key) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET is not configured');
  }

  const { client, DeleteObjectCommand } = await getS3Client();
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}
