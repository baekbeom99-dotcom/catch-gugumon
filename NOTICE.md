# 함께 쓴 것 (Notices)

## 이 저장소의 저작권

잡아라! 구구단 몬스터(catch-gugumon)의 직접 만든 코드·글·설계는 Copyright (c) 2026 baekbeom99-dotcom 에게 있고, 모든 권리를 보유합니다.
어떻게 쓸 수 있는지는 [LICENSE](LICENSE)에 적었습니다. 아래 "함께 쓴 것"은 LICENSE가 아니라 각자의 라이선스를 따릅니다.

### 캐릭터 그림에 대하여

`src/field/art/creatures/` 아래의 스프라이트 그림과 앱 안에서 쓰는 캐릭터 그림 가운데에는 다른 사람이 권리를 가진 캐릭터·이름·상표를 그리거나 닮은 것이 포함되어 있습니다.
- 그 권리는 각 권리자에게 있고, 이 저장소의 저작권자는 그 그림에 대한 권리를 주장하지도, 다른 사람에게 허락하지도 않습니다.
- 이 앱은 비영리 학습용 팬 앱이며, 권리자가 내려 달라고 요청하면 해당 그림을 내립니다. 자세한 점검 내용은 [docs/sprite-license-audit.md](docs/sprite-license-audit.md)를 보세요.
- 이 그림들은 LICENSE의 "허용하는 것"에 들어가지 않으며, 복사·재배포할 수 있다는 뜻이 아닙니다.

## pixelfx

필드 모험의 전투 효과에 [pixelfx](https://github.com/patch-gg/pixelfx) (MIT License)의 효과 세 가지를 그대로 불러 쓴다.
효과 코드는 고치지 않았고, 우리 코드(`src/field/fx.ts`)가 색·빠르기·트는 길이만 정해서 부른다.

| 쓰는 곳 | pixelfx 효과 | 파일 |
|---|---|---|
| 풀숲에서 만나 전투로 넘어갈 때 (별 조리개가 닫힘) | Star iris (transitions) | `pixelfx/src/fx/transitions/star-iris.js` |
| 정답 기술이 야생 구구몬에게 맞을 때 | Hit spark (impacts) | `pixelfx/src/fx/impacts/hit-spark.js` |
| 캡슐로 잡았을 때 (금빛으로 색만 바꿈) | Collect burst (pickups) | `pixelfx/src/fx/pickups/collect-burst.js` |

세 효과 모두 공용 코어(`pixelfx/src/core/`)를 함께 쓴다. pixelfx의 NOTICE에 따르면 위 세 효과는
Sprite Fusion의 오픈 소스 픽셀 효과(https://www.spritefusion.com/pixel-art-vfx, Copyright (c) 2026 Hugo Duprez, MIT License)를 바탕으로 한 부분이 있다.

```
MIT License

Copyright (c) 2026 Patch
Copyright (c) 2026 Hugo Duprez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 우리 그림

필드 타일·주인공 픽셀 그림(`src/field/pixelArt.ts`, `src/field/maps/*Tiles.ts`)은 이 앱을 위해 우리 색으로 새로 그린 것이다.
다른 게임의 타일이나 주인공을 보고 옮겨 그리지 않았다.
