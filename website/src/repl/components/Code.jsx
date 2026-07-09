import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { backgroundVideoUrl } from '@src/repl/backgroundVideoStore.mjs';
import { webcamStream, startWebcam, stopWebcam } from '@src/repl/webcamStore.mjs';
import { useSettings } from '@src/settings.mjs';

// type Props = {
//   containerRef:  React.MutableRefObject<HTMLElement | null>,
//   editorRef:  React.MutableRefObject<HTMLElement | null>,
//   init: () => void
// }
export function Code(Props) {
  const { editorRef, containerRef, init } = Props;
  const videoUrl = useStore(backgroundVideoUrl);
  const stream = useStore(webcamStream);
  const webcamVideoRef = useRef(null);
  const { backgroundVideoOpacity, backgroundVideoFlipped, webcamEnabled, webcamSize } = useSettings();

  useEffect(() => {
    if (webcamEnabled) {
      startWebcam();
    } else {
      stopWebcam();
    }
  }, [webcamEnabled]);

  // release the camera hardware if the editor itself goes away, not just on toggle-off
  useEffect(() => () => stopWebcam(), []);

  useEffect(() => {
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative grow h-full flex flex-col overflow-hidden">
      {videoUrl && (
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            opacity: backgroundVideoOpacity,
            zIndex: 0,
            transform: backgroundVideoFlipped ? 'scaleX(-1)' : undefined,
          }}
        />
      )}
      {stream && (
        <video
          ref={webcamVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute rounded-full object-cover pointer-events-none border border-muted"
          style={{ width: webcamSize, height: webcamSize, right: '4%', bottom: '4%', zIndex: 20 }}
        />
      )}
      <section
        className={'code-container text-gray-100 cursor-text pb-0 overflow-auto grow z-10'}
        ref={(el) => {
          containerRef.current = el;
          if (!editorRef.current) {
            init();
          }
        }}
      ></section>
    </div>
  );
}
