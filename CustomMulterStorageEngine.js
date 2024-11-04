import { createWriteStream, unlinkSync, statSync, unlink, fstat, mkdirSync, writeFile, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import { mkdir } from "fs/promises";
// let mkdirp = require('mkdirp')

function getFilename(req, file, cb) {
  randomBytes(16, function (err, raw) {
    cb(err, err ? undefined : raw.toString("hex"));
  });
}

function getDestination(req, file, cb) {
  cb(null, tmpdir());
}

class FFMPEGDiskStorageHandler {
  constructor(opts) {
    this.getFilename = opts.filename || getFilename;
    // this.getFilename =  getFilename;

    if (typeof opts.destination === "string") {
      // mkdirp.sync(opts.destination)
      this.getDestination = function ($0, $1, cb) {
        cb(null, opts.destination);
      };
    } else {
      this.getDestination = opts.destination || getDestination;
    }
  }
  _handleFile(req, file, cb) {
    let that = this;

    that.getDestination(req, file, function (err, destination) {
      if (err) return cb(err);

      that.getFilename(req, file, function (err, multer_filename) {
        try {

          if (err) return cb(err);

          let original_filename = multer_filename.split('.')[0]
          let multer_foldername = original_filename || randomBytes(8).toString("hex")

          let dash_path_folder = join(destination, multer_foldername, 'dash')
          mkdirSync(dash_path_folder, { recursive: true })

          let multer_path_file = join(destination, multer_foldername, `original.mp4`);
          let outStream = createWriteStream(multer_path_file);

          writeFileSync(join(destination, multer_foldername, `${original_filename}`), '')

          file.stream.pipe(outStream);
          outStream.on("error", cb);
          outStream.on("finish", function () {
            let ffmpeg_filename = ['manifest', 'mpd'].join(".");
            let ffmpeg_path_file = join(dash_path_folder, ffmpeg_filename);
            // ffmpeg -i input.mp4 -map 0 -codec copy -f dash -min_seg_duration 5000000 -use_template 1 -use_timeline 1 -init_seg_name init-\$RepresentationID\$.mp4 -media_seg_name chunk-\$RepresentationID\$-\$Number\$.m4s output.mpd
            ffmpeg(multer_path_file)
              .outputOptions([
                '-map 0',
                '-codec copy',
                '-f dash',
                '-min_seg_duration 5000000',
                '-use_template 1',
                '-use_timeline 1',
                '-init_seg_name init-$RepresentationID$.mp4',
                '-media_seg_name chunk-$RepresentationID$-$Number$.m4s'
              ])
              .output(ffmpeg_path_file)
              .on('start', (commandLine) => {
                // console.log('FFmpeg command: ', commandLine);
              })
              .on('error', (err, stdout, stderr) => {
                console.error('An error occurred: ' + stderr);
                cb(stderr)
              })
              .on('end', () => {
                console.log('Processing finished successfully');
                // unlinkSync(multer_path_file);
                let { size } = statSync(multer_path_file);
                cb(null, {
                  destination: destination,
                  filename: multer_filename,
                  path: multer_path_file,
                  size: size,
                });
              })
              .run();

          });

        } catch (error) {
          cb(error)
        }
      });
    });
  }
  _removeFile(req, file, cb) {
    let path = file.path;

    delete file.destination;
    delete file.filename;
    delete file.path;

    unlink(path, cb);
  }
}

export function FFMPEGDiskStorage(opts) {
  return new FFMPEGDiskStorageHandler(opts);
}
