import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import { FFMPEGDiskStorage } from "./CustomMulterStorageEngine";
const app = express();
const port = 3002;

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const units = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*",
    allowedHeaders: "*",
    exposedHeaders: "*",
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "/tmp/my-uploads");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload_v1 = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads");
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      let composeFilename = file.fieldname + "-" + uniqueSuffix; // implement later
      cb(null, file.originalname);
    },
  }),
}).single("video");

const upload_v2 = multer({
  storage: FFMPEGDiskStorage({
    destination: function (req, file, cb) {
      cb(null, "uploads");
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      let composeFilename = file.fieldname + "-" + uniqueSuffix;
      cb(null, file.originalname);
    },
  }),
}).single("video");

// ffmpeg -i file.mp4 -c copy -movflags frag_keyframe+empty_moov+default_base_moof output.mp4
app.post("/upload", upload_v2, (req, res, next) => {
  try {
    let file = req.file;
    console.log(req.file);
    res.status(201).json(file);
  } catch (error) {
    next(error);
  }
});

app.get("/v1/video/:filename", async (req, res, next) => {
  const { filename } = req.params;
  const path = `uploads/${filename}`;

  ffmpeg.ffprobe(path, async (err, metadata) => {
    if (err) {
      console.error(err);
      return res.status(404).send("Video not found");
    }
    let f_duration = metadata.format.duration || 0
    let [video, audio] = metadata.streams
    // 8.363667
    // Retrieve the duration of each stream
    const truncated_duration = Math.floor(f_duration * 10) / 10
    const truncated_video_duration = parseFloat((video?.duration as any - truncated_duration).toString().slice(0, 5)) // 0.03166699999999878
    const truncated_audio_duration = parseFloat((audio?.duration as any - truncated_duration).toString().slice(0, 5)) // 0.0519999999999996
    const r_duration = parseFloat((truncated_video_duration + truncated_audio_duration + truncated_duration).toFixed(3))

    const video_duration = f_duration
    const video_bit_rate = metadata.format.bit_rate
    const video_file_size = metadata.format.size

    // Calculate the maximum duration between video and audio streams
    // const totalDuration = Math.max(video_duration, audio_duration, f_duration);
    let filesize = fs.statSync(path);
    const metadata_fileSize: number = filesize.size ?? 0;
    // console.log({filesize,metadata_fileSize})
    // console.log({metadata})
    const range = req.headers.range;
    try {
      if (range) {
        let [start, end] = range
          .replace(/bytes=/, "")
          .split("-")
          .map((n) => parseInt(n || "0", 10));
        end = end || metadata_fileSize;
        if (end > metadata_fileSize) {
          end = metadata_fileSize;
        }
        if (start > end) {
          start -= start - end;
        }
        const chunkSize = end - start;
        // let VideoBitRate = metadata?.format?.bit_rate ?? 0;
        // const ChunkDuration = (chunkSize * 8) / VideoBitRate;

        const VideoBitRate = parseFloat(metadata?.format?.bit_rate as unknown as string) || 0;
        const ChunkDuration = VideoBitRate ? (chunkSize * 8) / VideoBitRate : 0;

        const file = fs.createReadStream(path, { start, end: Infinity });
        const headers = {
          "Content-Range": `bytes ${start}-${end}/${metadata_fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Type": "video/mp4",
          "Video-Size": metadata_fileSize,
          "Video-Duration": video_duration,
          "Video-Bit-Rate": video_bit_rate,
          "Video-Chunk-Duration": ChunkDuration,
        };

        process.stdout.write(`\rchunkSize:${formatBytes(chunkSize)} start:${formatBytes(start)} end:${formatBytes(end)}`)
        res.writeHead(206, headers);
        file.pipe(res);
      } else {
        const headers = {
          "Content-Length": metadata_fileSize,
          "Content-Type": "video/mp4",
          "Video-Duration": video_duration,
          "Video-Bit-Rate": video_bit_rate,
          "Video-": video_bit_rate,
        };

        res.writeHead(200, headers);
        fs.createReadStream(path).pipe(res);
      }
    } catch (error) {
      next(error);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
