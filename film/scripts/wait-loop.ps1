# film\wait-loop.mp4: 7.1 s of the right half during today's wait (v3b frames 342-553, after the 1938 holds and before the boarding close-in:
# ghosts 3 and 4 leave the corner and pass the rider), centred on a 1920x1080 #17121F frame.
# Silent, H.264 High 1080p30. NOTE: it is Google-tile footage and counts toward the 30 s cap.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
ffmpeg -y -hide_banner -loglevel error -start_number 342 -framerate 30 -i "frames\R\%05d.jpg" -frames:v 212 `
  -vf "pad=1920:1080:480:0:color=0x17121F,format=yuv420p" `
  -c:v libx264 -profile:v high -preset slow -b:v 8M -maxrate 10M -bufsize 16M -r 30 -movflags +faststart -an "film\wait-loop.mp4"
ffprobe -v error -show_entries stream=width,height,nb_frames -show_entries format=duration -of default=nw=1 "film\wait-loop.mp4"
