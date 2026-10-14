// Astro 설정 파일
// 지금은 거의 기본값이에요. 나중에 사이트 주소(site)나 통합(integration)을 여기에 추가해요.
import { defineConfig } from 'astro/config';

export default defineConfig({
  // 배포 후 실제 주소로 바꿔주세요. (sitemap, OG 태그 만들 때 쓰여요)
  site: 'https://banana-lab.pages.dev',
  build: {
    // CSS를 HTML 안에 넣어서 요청 수를 줄여요. 작은 사이트라 이게 더 빨라요.
    inlineStylesheets: 'always',
  },
});
