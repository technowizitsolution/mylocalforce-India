import React, { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiVolumeX, FiVolume2 } from 'react-icons/fi';

const VideoPlayer = ({
  source,
  className = '',
  autoplay = true,
  muted = true,
  loop = true,
  controls = false,
  poster,
  onLoad,
  onError,
  onProgress,
}) => {
  const videoRef = useRef(null);
  const [isPaused, setIsPaused] = useState(!autoplay);
  const [isMuted, setIsMuted] = useState(muted);

  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const togglePlay = () => setIsPaused((prev) => !prev);
  const toggleMute = () => setIsMuted((prev) => !prev);

  return (
    <div
      className={`mx-4 sm:mx-6 lg:mx-8 mb-6 sm:mb-8 relative rounded-2xl overflow-hidden shadow-lg group ${className}`}
    >
      <video
        ref={videoRef}
        src={source}
        poster={poster}
        loop={loop}
        muted={isMuted}
        autoPlay={autoplay}
        controls={controls}
        playsInline
        className="w-full aspect-video object-cover"
        onLoadedData={onLoad}
        onError={onError}
        onTimeUpdate={
          onProgress
            ? (e) =>
                onProgress({
                  currentTime: e.target.currentTime,
                  duration: e.target.duration,
                })
            : undefined
        }
      />

      {/* Custom Controls — always visible on mobile, hover-reveal on desktop */}
      <div className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={togglePlay}
          className="bg-black/45 hover:bg-black/60 text-white p-2.5 sm:p-2 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          aria-label={isPaused ? 'Play video' : 'Pause video'}
        >
          {isPaused ? (
            <FiPlay className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <FiPause className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>

        <button
          onClick={toggleMute}
          className="bg-black/45 hover:bg-black/60 text-white p-2.5 sm:p-2 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
          aria-label={isMuted ? 'Unmute video' : 'Mute video'}
        >
          {isMuted ? (
            <FiVolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <FiVolume2 className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default VideoPlayer;