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
          // let ffmpeg_filename = [fname, "ffmpeg", ext].join(".");
          let ffmpeg_filename = ['video', "ffmpeg", ext].join(".");
          let ffmpeg_path_file = join(destination, ffmpeg_filename);
          ffmpeg(multer_path_file)
            .inputFormat("mp4")
            .outputOptions("-c copy")
            .outputOptions(
              "-movflags",
              // 'frag_keyframe+empty_moov+default_base_moof'
              "faststart+frag_keyframe+empty_moov+default_base_moof+separate_moof"
            )
            .output(ffmpeg_path_file, { end: true })
            .on("end", () => {
              console.log("Corte de video completado.");
              unlinkSync(multer_path_file);

              let { size } = statSync(ffmpeg_path_file);
              // 3076000290
              // 3076362168
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
