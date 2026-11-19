/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

declare const process: { env: Record<string, string | undefined> };

// GitHub Pages는 https://<계정>.github.io/<저장소>/ 아래에서 열리므로 배포 때 BASE_PATH로 경로를 넘긴다.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 등록은 src/pwa/autoUpdate.ts에서 직접 한다 (탭 복귀·30분마다 확인, 안전할 때 새로고침)
      injectRegister: false,
      includeAssets: ['icon.svg'],
      // Google 글꼴을 한 번 받으면 오프라인에서도 쓰도록 캐시
      workbox: {
        // 시작 화면 그림(webp)도 미리 받아 둬서 오프라인에서도 시작된다
        globPatterns: ['**/*.{js,css,html}', 'assets/title-*.webp'],
        // 새 버전을 받으면 기다리지 않고 바로 넘겨받는다 (새로고침은 autoUpdate.ts가 안전할 때)
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: '구구단 몬스터 탐험대',
        short_name: '구구몬',
        description: '구구단을 풀어 몬스터를 잡고 나만의 펫을 키워요',
        lang: 'ko',
        theme_color: '#ffe14d',
        background_color: '#fff1c9',
        display: 'standalone',
        start_url: base,
        scope: base,
        orientation: 'portrait',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // 효과 재생 테스트(fxPlay)가 다른 파일과 동시에 돌면 효과 코드 받기가 늦어져 시간 초과가 나므로 파일을 하나씩 돌린다
    fileParallelism: false,
  },
});
