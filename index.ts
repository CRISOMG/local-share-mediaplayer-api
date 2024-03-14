import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import { FFMPEGDiskStorage } from "./CustomMulterStorageEngine";
const app = express();
const port = 3000;

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
    let filesize = fs.statSync(path);
    const fileSize: number = metadata?.format?.size ?? 0;
    const range = req.headers.range;
    try {
      if (range) {
        let [start, end] = range
          .replace(/bytes=/, "")
          .split("-")
          .map((n) => parseInt(n ?? 0, 10));
        end = end ?? fileSize;

        if (end >= fileSize) {
          end = fileSize;
        }

        if (start > end) {
          start -= start - end;
        }

        const chunkSize = end - start;

        // await new Promise((resolve) => setTimeout(resolve, 3000));

        let VideoBitRate = metadata?.format?.bit_rate ?? 0;

        const ChunkDuration = (chunkSize * 8) / VideoBitRate;

        const file = fs.createReadStream(path, { start, end });
        const headers = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize,
          "Content-Type": "video/mp4",
          "Video-Size": fileSize,
          "Video-Duration": metadata.format.duration,
          "Video-Bit-Rate": metadata.format.bit_rate,
          "Video-Chunk-Duration": ChunkDuration,
        };

        console.log({ chunkSize, start, end });
        res.writeHead(206, headers);
        file.pipe(res);
      } else {
        const headers = {
          "Content-Length": fileSize,
          "Content-Type": "video/mp4",
          "Video-Duration": metadata.format.duration,
          "Video-Bit-Rate": metadata.format.bit_rate,
          "Video-": metadata.format.bit_rate,
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
