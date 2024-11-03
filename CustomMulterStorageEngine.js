import { createWriteStream, unlinkSync, statSync, unlink } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";
import ffmpeg from "fluent-ffmpeg";
// var mkdirp = require('mkdirp')

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
    var that = this;

    that.getDestination(req, file, function (err, destination) {
      if (err) return cb(err);

      that.getFilename(req, file, function (err, multer_filename) {
        if (err) return cb(err);

        var multer_path_file = join(destination, multer_filename);
        var outStream = createWriteStream(multer_path_file);

        file.stream.pipe(outStream);
        outStream.on("error", cb);
        outStream.on("finish", function () {
          let [fname, ext] = multer_filename.split(".");
          let ffmpeg_filename = ['video' || fname, "ffmpeg", ext].join(".");
          let ffmpeg_path_file = join(destination, ffmpeg_filename);
          ffmpeg(multer_path_file)
            .inputFormat("mp4")
            // .inputOptions('-fflags +genpts')
            .outputOptions("-y")
            .outputOptions("-c copy")
            // .outputOptions("-vsync cfr")
            // .outputOptions('-itsoffset 0.0')
            // .outputOptions('-avoid_negative_ts make_zero')
            // .outputOptions('-c:v libx264')
            // .outputOptions('-preset fast')
            // .outputOptions('-profile:v main')
            // .outputOptions('-level:v 4.0') 
            // .outputOptions('-g 48')
            // .outputOptions('-keyint_min 48')
            // .outputOptions('-c:a aac')
            // .outputOptions('-b:a 128k')
            // .outputOptions('-movflags +faststart')
            .outputOptions('-movflags +faststart+frag_keyframe+empty_moov+default_base_moof+separate_moof+omit_tfhd_offset')
            // .outputOptions('-frag_duration 1000000')
            // .outputOptions('-segment_time 2')
            // .outputOptions(  '-reset_timestamps 1')

            // .outputOptions('-video_track_timescale 90000')

            // .outputOptions('-min_frag_duration 1000000')

            // .outputOptions('-movflags faststart+frag_keyframe+separate_moof')
            // .outputOptions('-movflags faststart+frag_keyframe+separate_moof')
            // .outputOptions(  '-frag_duration 1000000')
            // .outputOptions(  '-reset_timestamps 1')
            // .outputOptions(  '-segment_time 1')
            // .outputOptions( '-movflags frag_keyframe')
            // .outputOptions( '-movflags +faststart+frag_keyframe')
          //   .outputOptions(
          //     // '-movflags','faststart+frag_keyframe+empty_moov+default_base_moof+separate_moof',
          // //     // '-reset_timestamps','1',
          //     //  '-avoid_negative_ts', 'make_zero'
          // //     // '-movflags','faststart+frag_keyframe+default_base_moof+separate_moof',
          // //     // '-segment_time','10',
          // //     // '-frag_duration','1000000',
          // //     // '-f','segment',
              
          // )
            .output(ffmpeg_path_file)
            .on("end", () => {
              unlinkSync(multer_path_file);
              let { size } = statSync(ffmpeg_path_file);
              cb(null, {
                destination: destination,
                filename: ffmpeg_filename,
                path: ffmpeg_path_file,
                size: size,
              });
            })
            .on("finish", () => {
              console.log("fklasjdf;akdsljfas;lkdfsa;ldkfjas;lkf");
            })
            .on("error", (err) => {
              cb(err);
              console.error("Error al cortar el video:", err);
            })
            .run();
        });
      });
    });
  }
  _removeFile(req, file, cb) {
    var path = file.path;

    delete file.destination;
    delete file.filename;
    delete file.path;

    unlink(path, cb);
  }
}

export function FFMPEGDiskStorage(opts) {
  return new FFMPEGDiskStorageHandler(opts);
}
