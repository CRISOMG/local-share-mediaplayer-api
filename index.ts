import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";
import { FFMPEGDiskStorage } from "./CustomMulterStorageEngine";


import { exec, execSync } from 'child_process';
import os from 'os';
import path from 'path';

const app = express();
const port = 3003;

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
app.use('/uploads', express.static('uploads'))

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

  // video.ffmpeg.mp4
  const file_path = `/home/cris/work/onegroup/onegroup-api/uploads/${filename}`;

  ffmpeg.ffprobe(file_path, async (err, metadata) => {
    if (err) {
      console.error(err);
      return res.status(404).send("Video not found");
    }
    let f_duration = metadata.format.duration
    let [video, audio] = metadata.streams
    const video_duration = metadata.format.duration || 0
    const video_bit_rate = metadata.format.bit_rate
    const video_file_size = metadata.format.size

    // Calculate the maximum duration between video and audio streams
    // const totalDuration = Math.max(video_duration, audio_duration, f_duration);
    let filesize = fs.statSync(file_path);
    const metadata_fileSize: number = filesize.size ?? 0;
    // console.log({filesize,metadata_fileSize})
    // console.log({metadata})
    const range = req.headers.range;
    try {
      if (range) {
        let [rangeType, interval] = range.split('=')
        let [start, end] = interval.split("-").map((n) => parseFloat(n || "0"));


        let isRangeTypeBytes = rangeType == 'bytes';
        let maxValueEnd = isRangeTypeBytes ? metadata_fileSize : video_duration;
        end = end || maxValueEnd;
        if (end > maxValueEnd) {
          end = maxValueEnd;
        }
        if (start > end) {
          start -= start - end;
        }
        let chunkSize = end - start;
        const VideoBitRate = parseFloat(metadata?.format?.bit_rate as unknown as string) || 0;

        let ContentLength = isRangeTypeBytes ? chunkSize : chunkSize * (VideoBitRate / 8)
        const ChunkDuration = isRangeTypeBytes ? (chunkSize * 8) / VideoBitRate : chunkSize;

        // const ChunkDuration = 0;

        // const file = fs.createReadStream(path, { start, end });
        let headers = {
          "Content-Range": `${rangeType} ${start}-${end}/${maxValueEnd}`,
          "Accept-Ranges": rangeType,
          "Content-Type": "video/mp4",
          // 'Content-Disposition': 'inline',
          // 'Content-Length': ContentLength,
          "Video-Size": metadata_fileSize,
          "Video-Duration": video_duration,
          "Video-Bit-Rate": video_bit_rate,
          "Video-Chunk-Duration": ChunkDuration,
        };

        // process.stdout.write(`\rchunkSize:${formatBytes(chunkSize)} start:${formatBytes(start)} end:${formatBytes(end)}`)
        // process.stdout.write(`\rchunkSize:${(chunkSize)} start:${(start)} end:${(end)}`)

        Object.entries(headers).forEach(([key, value]) => res.setHeader(key, `${value}`));

        let stream: ffmpeg.FfmpegCommand | fs.ReadStream;
        if (rangeType == 'bytes') {
          stream = fs.createReadStream(file_path, { start, end })
          stream.pipe(res)
          // res.sendFile(file_path, (err) => {
          //   if (err) {
          //     console.log(err.message)
          //     res.status(400).end(err.message)
          //   }
          // })
        }

        if (rangeType == 'seconds') {

          // const tempFilePath = path.join(os.tmpdir(), 'output.tmp.mp4');
          const tempFilePath = path.join(__dirname, 'o.mp4');
          // const mp4boxCommand = `MP4Box -splitx ${start}:${end} ${file_path} -out ${tempFilePath}`;
          // fs.unlinkSync(tempFilePath)
          // const mp4boxCommand = `ffmpeg -ss ${start} -to ${end} -i ${file_path} -y -c copy ${tempFilePath}`;
          const mp4boxCommand = `ffmpeg -i ${file_path} -ss ${start} -to ${end} -movflags +faststart+frag_keyframe+empty_moov+default_base_moof+separate_moof+omit_tfhd_offset -y -c copy ${tempFilePath}`;
          exec(mp4boxCommand, (error, stdout, stderr) => {
            if (stderr) console.error('stderr:', stderr);
            if (error) {
              console.error('Error executing:', error.message);
              return;
            }

            res.sendFile(tempFilePath, (err) => {
              if (err) {
                console.log(err.message)
                res.status(400).end(err.message)
              }
            })

            // stream = ffmpeg(tempFilePath)
            //   .outputFormat('mp4')
            //   .videoCodec('copy')
            //   .audioCodec('copy')
            //   .outputOptions(
            //     '-movflags +faststart+frag_keyframe+empty_moov+default_base_moof+separate_moof+omit_tfhd_offset',
            //   )
            //   .outputOptions('-loglevel error')
            //   .on('error', (err, stdout, stderr) => {
            //     console.error('An error occurred:', err.message);
            //     console.error('FFmpeg stdout:', stdout);
            //     console.error('FFmpeg stderr:', stderr);
            //   })
            // stream.clone().output('/home/cris/work/onegroup/onegroup-api/o.mp4', { end: true }).on('error', (err, stdout, stderr) => {
            //   console.error('An error occurred:', err.message);
            //   console.error('FFmpeg stdout:', stdout);
            //   console.error('FFmpeg stderr:', stderr);
            // }).on('end', () => {
            //   console.log('copy to /home/cris/work/onegroup/onegroup-api/o.mp4')
            // }).run()
            // stream.pipe(res)


          })


        }
      } else {
        const headers = {
          "Accept-Ranges": 'bytes',
          // "Content-Length": metadata_fileSize,
          'Content-Disposition': 'inline',
          "Content-Type": "video/mp4",
          "Video-Duration": video_duration,

          // 'Connection': 'close'
          // "Video-Duration": video_duration,
          // "Video-Bit-Rate": video_bit_rate,
        };
        // res.writeHead(200, headers);
        Object.entries(headers).forEach(([key, value]) => res.setHeader(key, `${value}`));
        // fs.createReadStream(file_path).pipe(res, { end: true });
        res.sendFile(file_path, (err) => {
          if (err) {
            console.log(err.message)
            res.status(400).end(err.message)
          }
        })
      }
    } catch (error) {
      console.log(error.message)
      next(error);
    } finally {
      // todo
    }
  });
});

app.get("/v1/video-list", async (req, res, next) => {
  try {
    let dirs = fs.readdirSync(path.resolve(__dirname, 'uploads'))
    res.json(dirs).end()
  } catch (error) {
    next(error)
  }
});

app.delete('/v1/video-list', async (req, res, next) => {
  try {

    exec(`rm -rf ./uploads/**`, (error, stdout, stderr) => {
      if (stderr) console.error('stderr:', stderr);
      if (error) {
        console.error('Error executing:', error.message);
        return res.status(500).send(stderr)
      }
      res.json({
        result: 'uploads folder flushed'
      }).end()
    })
  } catch (error) {
    next(error)
  }
})

app.get('/v1/find-video-path', async (req, res, next) => {

  try {
    let { body } = req

    if (!body.filename) {
      return next('filename is required')
    }

    exec(`find ./uploads -type f -name "${body?.filename}"`, (error, stdout, stderr) => {
      if (stderr) console.error('stderr:', stderr);
      if (error) {
        console.error('Error executing:', error.message);
        return;
      }
      res.json({
        result: stdout
      }).end()
    })
  } catch (error) {
    next(error)
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
