import { selectLocale } from "../locale";
const preferences = navigator.languages?.length
  ? navigator.languages.join(",")
  : navigator.language;
export const locale = selectLocale(
  preferences || document.documentElement.lang,
);
document.documentElement.lang = locale;
const korean = {
  Preview: "미리보기",
  Settings: "설정",
  "Open settings": "설정 열기",
  "Close settings": "설정 닫기",
  "View result fullscreen": "결과 전체화면으로 보기",
  "Exit fullscreen": "전체화면 닫기",
  Slider: "슬라이더",
  Lens: "렌즈",
  "View at actual size": "실제 픽셀 크기로 보기",
  "Original image": "원본 이미지",
  "Upscaled image": "업스케일 결과",
  Original: "원본",
  Result: "결과",
  "Before/after split position": "원본과 결과 비교 위치",
  "Save result": "결과 저장",
  Before: "처리 전",
  After: "처리 후",
  "AI model": "AI 모델",
  "Select an AI model": "AI 모델 선택",
  "Close model picker": "모델 선택 닫기",
  "Close enlarged comparison": "큰 사진 닫기",
  "Sending image": "이미지 전송 중",
  "Preparing job": "작업 준비 중",
  "Waiting for GPU": "GPU 대기 중",
  Upscaling: "업스케일 중",
  "Receiving result": "결과 받는 중",
  Cancelling: "취소 중",
  "Cancel job": "작업 취소",
  Cancel: "취소",
  "Upscale complete": "업스케일 완료",
  "Job cancelled.": "작업을 취소했습니다.",
  "Save ZIP": "ZIP 저장",
  "Upscale again": "다시 업스케일",
  Upscale: "업스케일",
  "Server files expire five minutes after completion.":
    "서버의 작업 파일은 완료 5분 후 삭제됩니다.",
  "Upscale complete. Your result is ready to save.":
    "업스케일 완료. 결과를 저장할 수 있습니다.",
  "Choose a PNG, JPG or WebP image.": "PNG, JPG 또는 WebP 이미지를 선택하세요.",
  "The maximum file size is 32 MiB per image.":
    "이미지 한 장의 최대 크기는 32 MiB입니다.",
  "The job was interrupted.": "작업이 중단되었습니다.",
  "Change image": "이미지 변경",
  "Select image": "이미지 선택",
  "Open folder": "폴더 열기",
  Connecting: "연결 중",
  Connected: "서버 연결됨",
  Offline: "오프라인",
  "Install app": "앱 설치",
  Setup: "연결 및 설치",
  "Drop to open": "놓아서 열기",
  "Drop images here": "이미지를 여기에 놓으세요",
  "Up to 32 MiB per file": "파일당 최대 32 MiB",
  Clear: "비우기",
  Files: "파일 목록",
  Reconnect: "다시 연결",
  "Upscale settings": "업스케일 설정",
  "Output size": "출력 크기",
  "Output scale": "출력 배율",
  Custom: "직접 지정",
  "Size by": "기준",
  Scale: "배율",
  Width: "가로 너비",
  "Width (px)": "가로 (px)",
  "Output format": "저장 형식",
  "Advanced settings": "고급 설정",
  "Compression (0–100)": "압축 (0–100)",
  "Tile size": "타일 크기",
  "Enter 0 for automatic or at least 32.": "자동(0) 또는 32 이상을 입력하세요.",
  Auto: "자동",
  "TTA mode": "TTA 모드",
  Elapsed: "경과",
  "Upscale failed": "업스케일 실패",
  "Could not open the image.": "이미지를 열 수 없습니다.",
  "Server request failed": "서버 요청 실패",
  "Unable to reach the host. Check your network connection.":
    "호스트에 연결할 수 없습니다. 같은 네트워크에 연결했는지 확인하세요.",
  "Pass {index} of {total}": "{index}/{total}차 처리",
  "{current} of {total} images": "{current}/{total}장",
  "Upscale {count} images": "{count}장 업스케일",
  "Enlarge {model} comparison": "{model} 비교 사진 크게 보기",
  "{model} comparison": "{model} 비교 사진",
};
export function t(
  message: keyof typeof korean,
  values?: Record<string, string | number>,
) {
  const text = locale === "ko" ? korean[message] : message;
  return values
    ? text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key]))
    : text;
}
