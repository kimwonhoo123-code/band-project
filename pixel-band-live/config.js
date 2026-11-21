// ===== 여기만 고치면 됩니다 =====
globalThis.PIXEL_LIVE_CONFIG = {
  // "taskbar" = 배경 없이 화면 맨 아래(작업표시줄 바로 위)에 멤버만 서 있음
  // "stage"   = 무대·조명·관객이 있는 박스 (이전 방식)
  stageMode: "taskbar",

  // 보컬 입 모양이 바뀌는 최소 간격(ms). 크게 하면 더 천천히 바뀜
  mouthHoldMs: 200,

  // 화면 확대 배율 (3이면 360x180px)
  scale: 3,

  // 의상: "stage" = 대기실 사진(버건디 벨벳 셔츠 / 카키 가죽 재킷 / 검은 재킷)
  //       "black" = 올블랙 아티스트 사진
  outfit: "stage",

  // 보컬(시미즈 이요리) 모습: "live" = 라이브 일러스트(갈색 곱슬머리, 검은 맨투맨, 텔레캐스터)
  //                         "stage" / "black" = 위 의상 사진 기준
  vocalLook: "live",

  // 영상 제목에 이 단어 중 하나가 들어갈 때만 등장. 비워두면 모든 영상에서 등장.
  titleKeywords: ["back number", "backnumber", "バックナンバー", "백넘버"],

  // 무대 왼쪽부터 순서. sprite: "iyori" | "bass" | "drums"
  // (범용 캐릭터를 쓰려면 sprite 대신 role/hair/skin/shirt/pants/instrument 지정)
  members: [
    { sprite: "bass" },
    { sprite: "iyori" },
    { sprite: "drums" },
  ],
};
