# Third-party build and licence record

Recorded through 2026-07-16 from installed package metadata and local executable output. This is evidence for the development seed, not legal advice.

## Direct JavaScript tooling

| Package | Resolved version | Declared licence | Use |
|---|---:|---|---|
| React | 19.2.7 | MIT | operator UI |
| React DOM | 19.2.7 | MIT | browser renderer |
| Vite | 7.3.6 | MIT | dev/production build |
| Vitest | 3.2.7 | MIT | focused tests |
| TypeScript | 5.9.3 | Apache-2.0 | strict type checking |
| tsx | 4.23.1 | MIT | local render/QA scripts |
| @vitejs/plugin-react | 4.7.0 | MIT | React transform |
| playwright-core | 1.61.1 | Apache-2.0 | installed-Chromium QA only |
| Ajv | 8.20.0 | MIT | Draft 2020-12 public contract validation |
| ajv-formats | 3.0.1 | MIT | UUID and date-time format validation |

`npm audit --audit-level=high` reported 0 vulnerabilities on 2026-07-16. The exact transitive dependency graph is locked in `package-lock.json`.

## FFmpeg development runtime

The verified artifact was rendered with:

```text
ffmpeg version 8.1.1-full_build-www.gyan.dev
built with gcc 15.2.0 (Rev13, Built by MSYS2 project)
configuration: --enable-gpl --enable-version3 --enable-static --disable-w32threads --disable-autodetect --enable-cairo --enable-fontconfig --enable-iconv --enable-gnutls --enable-lcms2 --enable-libxml2 --enable-gmp --enable-bzlib --enable-lzma --enable-libsnappy --enable-zlib --enable-librist --enable-libsrt --enable-libssh --enable-libzmq --enable-avisynth --enable-libbluray --enable-libcaca --enable-libdvdnav --enable-libdvdread --enable-sdl2 --enable-libaribb24 --enable-libaribcaption --enable-libdav1d --enable-libdavs2 --enable-libopenjpeg --enable-libquirc --enable-libuavs3d --enable-libxevd --enable-libzvbi --enable-liboapv --enable-libqrencode --enable-librav1e --enable-libsvtav1 --enable-libvvenc --enable-libwebp --enable-libx264 --enable-libx265 --enable-libxavs2 --enable-libxeve --enable-libxvid --enable-libaom --enable-libjxl --enable-libsvtjpegxs --enable-libvpx --enable-mediafoundation --enable-libass --enable-frei0r --enable-libfreetype --enable-libfribidi --enable-libharfbuzz --enable-liblensfun --enable-libvidstab --enable-libvmaf --enable-libzimg --enable-amf --enable-cuda-llvm --enable-cuvid --enable-dxva2 --enable-d3d11va --enable-d3d12va --enable-ffnvcodec --enable-libvpl --enable-nvdec --enable-nvenc --enable-vaapi --enable-libshaderc --enable-vulkan --enable-libplacebo --enable-opencl --enable-libcdio --enable-openal --enable-libgme --enable-libmodplug --enable-libopenmpt --enable-libopencore-amrwb --enable-libmp3lame --enable-libshine --enable-libtheora --enable-libtwolame --enable-libvo-amrwbenc --enable-libcodec2 --enable-libilbc --enable-libgsm --enable-liblc3 --enable-libopencore-amrnb --enable-libopus --enable-libspeex --enable-libvorbis --enable-ladspa --enable-libbs2b --enable-libflite --enable-libmysofa --enable-librubberband --enable-libsoxr --enable-chromaprint --enable-whisper
```

The executable reports GNU GPL version 3 or later. It is an operator-installed development dependency and is not bundled by this seed. Any future redistribution must undergo a dedicated dependency and licensing review.

## Browser QA

Installed Google Chrome was used headlessly for development QA and screenshots. It is not included in the application artifact.
