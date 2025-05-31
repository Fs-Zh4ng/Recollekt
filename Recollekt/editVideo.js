const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/edit-video', upload.fields([
  { name: 'video' },
  { name: 'audio', maxCount: 1 }
]), async (req, res) => {
  try {
    const { start, end } = req.body;
    const videoFile = req.files['video'][0];
    const audioFile = req.files['audio']?.[0];
    const outputFilename = `edited_${uuidv4()}.mp4`;
    const outputPath = path.join(__dirname, '../public/videos', outputFilename);

    let command = ffmpeg(videoFile.path)
      .setStartTime(start)
      .setDuration(end - start);

    if (audioFile) {
      command = command
        .input(audioFile.path)
        .outputOptions('-map 0:v:0', '-map 1:a:0', '-shortest');
    }

    command
      .on('end', () => {
        fs.unlinkSync(videoFile.path);
        if (audioFile) fs.unlinkSync(audioFile.path);
        res.json({ videoUrl: `/videos/${outputFilename}` });
      })
      .on('error', (err) => {
        console.error(err);
        res.status(500).json({ error: 'Video processing failed' });
      })
      .save(outputPath);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
