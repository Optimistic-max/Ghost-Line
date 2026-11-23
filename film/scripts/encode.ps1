# Join frames\L\%05d.jpg | frames\R\%05d.jpg side by side -> film\race-split.mp4
# H.264 High, 1920x1080, 30 fps, 8 Mbps, +faststart, no audio (the edit adds sound).
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
ffmpeg -y -hide_banner -loglevel error -stats `
  -framerate 30 -i "frames\L\%05d.jpg" -framerate 30 -i "frames\R\%05d.jpg" `
  -filter_complex "[0:v][1:v]hstack=inputs=2,format=yuv420p[v]" -map "[v]" `
  -c:v libx264 -profile:v high -preset slow -b:v 8M -maxrate 10M -bufsize 16M `
  -r 30 -movflags +faststart -an "film\race-split.mp4"
ffprobe -v error -show_entries stream=codec_name,profile,width,height,r_frame_rate,nb_frames,bit_rate -show_entries format=duration,size -of default=nw=1 "film\race-split.mp4"
