export const builtins: Record<string, { name: string; description: string }> = {
  "upscayl-standard-4x": {
    name: "Upscayl Standard",
    description: "대부분의 이미지에 두루 어울리는 기본 모델입니다.",
  },
  "upscayl-lite-4x": {
    name: "Upscayl Lite",
    description:
      "대부분의 이미지에 어울리며, 화질 손실을 줄이면서 빠르게 처리합니다.",
  },
  "high-fidelity-4x": {
    name: "High Fidelity",
    description:
      "다양한 이미지에서 사실적인 디테일과 매끄러운 질감을 살립니다.",
  },
  "remacri-4x": {
    name: "Remacri",
    description:
      "자연스러운 사진에 선명도와 세부 묘사를 더합니다. 비상업용 모델입니다.",
  },
  "ultramix-balanced-4x": {
    name: "Ultramix",
    description:
      "자연스러운 사진에서 선명도와 세부 묘사의 균형을 맞춥니다. 비상업용 모델입니다.",
  },
  "ultrasharp-4x": {
    name: "Ultrasharp",
    description:
      "자연스러운 사진의 윤곽을 선명하게 살리는 데 중점을 둡니다. 비상업용 모델입니다.",
  },
  "digital-art-4x": {
    name: "Digital Art",
    description: "디지털 아트와 일러스트에 적합합니다.",
  },
};
export function describeModel(id: string) {
  return Object.hasOwn(builtins, id)
    ? builtins[id]
    : { name: id, description: "호스트에 설치한 사용자 모델입니다." };
}
