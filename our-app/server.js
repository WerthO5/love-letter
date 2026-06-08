import express from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()
const PORT = process.env.PORT || 3000
const uploadsDir = path.join(__dirname, 'uploads')

const USE_S3 = Boolean(process.env.AWS_S3_BUCKET)

let S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand
if (USE_S3) {
  // Lazy import AWS SDK v3 to keep local environment simple when not used
  const aws = await import('@aws-sdk/client-s3')
  S3Client = aws.S3Client
  PutObjectCommand = aws.PutObjectCommand
  ListObjectsV2Command = aws.ListObjectsV2Command
  DeleteObjectCommand = aws.DeleteObjectCommand
}

if (!USE_S3) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
  }
}

const storage = USE_S3 ? multer.memoryStorage() : multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${timestamp}-${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: (process.env.MAX_FILE_MB ? Number(process.env.MAX_FILE_MB) : 20) * 1024 * 1024 },
})

function getFileType(name, mime = '') {
  const MEDIA_EXTENSIONS = {
    video: ['mp4', 'mov', 'webm', 'ogg', 'ogv', 'm4v', 'avi', 'mkv', 'flv', 'wmv'],
    image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'heic'],
  }
  const lowerName = name.toLowerCase()
  const ext = lowerName.split('.').pop() || ''
  if (mime.startsWith('video/') || MEDIA_EXTENSIONS.video.includes(ext)) return 'video'
  if (mime.startsWith('image/') || MEDIA_EXTENSIONS.image.includes(ext)) return 'image'
  return 'unknown'
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json())
app.use(express.static(path.join(__dirname)))
if (!USE_S3) app.use('/uploads', express.static(uploadsDir))

let s3Client = null
if (USE_S3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    } : undefined,
  })
}

app.post('/api/upload', upload.array('media'), async (req, res) => {
  try {
    if (USE_S3) {
      const bucket = process.env.AWS_S3_BUCKET
      const uploaded = []
      for (const file of req.files || []) {
        const key = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        await s3Client.send(new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }))
        uploaded.push({
          filename: key,
          url: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(key)}`,
          name: file.originalname,
          type: getFileType(file.originalname, file.mimetype),
          mime: file.mimetype,
        })
      }
      return res.json({ files: uploaded })
    }

    const files = (req.files || []).map((file) => ({
      filename: file.filename,
      url: `/uploads/${encodeURIComponent(file.filename)}`,
      name: file.originalname,
      type: getFileType(file.originalname, file.mimetype),
      mime: file.mimetype,
    }))
    res.json({ files })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

app.get('/api/gallery', async (req, res) => {
  try {
    if (USE_S3) {
      const bucket = process.env.AWS_S3_BUCKET
      const list = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket }))
      const files = (list.Contents || []).map((obj) => ({
        filename: obj.Key,
        url: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(obj.Key)}`,
        name: obj.Key.replace(/^\\d+-/, ''),
        type: getFileType(obj.Key),
        mime: obj.Key.endsWith('.mp4') ? 'video/mp4' : 'image/png',
      }))
      return res.json({ files })
    }

    fs.readdir(uploadsDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to read uploads directory' })
      const gallery = files
        .filter(Boolean)
        .map((filename) => {
          const originalName = filename.replace(/^\\d+-/, '')
          const type = getFileType(originalName)
          return {
            filename,
            url: `/uploads/${encodeURIComponent(filename)}`,
            name: originalName,
            type,
            mime: type === 'video' ? 'video/mp4' : 'image/png',
          }
        })
      res.json({ files: gallery })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load gallery' })
  }
})

app.delete('/api/upload', async (req, res) => {
  const { filename } = req.body
  if (!filename) return res.status(400).json({ error: 'Filename is required' })
  try {
    if (USE_S3) {
      const bucket = process.env.AWS_S3_BUCKET
      await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: filename }))
      return res.json({ success: true })
    }
    const filePath = path.join(uploadsDir, filename)
    fs.unlink(filePath, (err) => {
      if (err) return res.status(500).json({ error: 'Failed to delete file' })
      res.json({ success: true })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

app.delete('/api/gallery', async (req, res) => {
  try {
    if (USE_S3) {
      const bucket = process.env.AWS_S3_BUCKET
      const list = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket }))
      const objects = (list.Contents || []).map((o) => ({ Key: o.Key }))
      if (objects.length === 0) return res.json({ success: true })
      // AWS supports batch delete, but for simplicity delete sequentially
      for (const obj of objects) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }))
      }
      return res.json({ success: true })
    }

    fs.readdir(uploadsDir, (err, files) => {
      if (err) return res.status(500).json({ error: 'Failed to read uploads directory' })
      const deletePromises = files.map((filename) => new Promise((resolve, reject) => {
        fs.unlink(path.join(uploadsDir, filename), (unlinkErr) => {
          if (unlinkErr) reject(unlinkErr)
          else resolve()
        })
      }))
      Promise.all(deletePromises)
        .then(() => res.json({ success: true }))
        .catch(() => res.status(500).json({ error: 'Failed to clear gallery' }))
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to clear gallery' })
  }
})

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`)
})
