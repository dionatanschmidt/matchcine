import { ImageResponse } from 'next/og';

export const size        = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#13111C',
        borderRadius: '40px',
      }}>
        <span style={{
          color: '#FFB13C', fontSize: 76, fontWeight: 800,
          letterSpacing: '-4px', fontFamily: 'sans-serif',
        }}>
          MC
        </span>
      </div>
    ),
    { ...size }
  );
}
