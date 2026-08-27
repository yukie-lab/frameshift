# FRAMESHIFT 操作手順書

Elite Dangerousクラス・宇宙飛行シミュレーター（Three.js + TypeScript + Vite）

---

## 1. 起動手順

```bash
cd frameshift
npm install        # 初回のみ
npm run dev        # 開発サーバー起動 → http://localhost:5173
```

本番ビルド:
```bash
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # ビルド結果の確認
```

## 2. URLパラメータ（シーンプリセット）

| URL | 内容 |
|---|---|
| `/?scene=start` | 岩石惑星接近（デフォルト） |
| `/?scene=rings` | 環付きガス巨大 |
| `/?scene=sc` | スーパークルーズ航行中 |
| `/?scene=jump` | ハイパースペースジャンプ発動 |
| `/?scene=cockpit` | 惑星低軌道（夜側/ターミネーター） |
| `&seed=N` | 恒星系シード指定（既定 1337） |
| `&nocomposer=1` | ポストプロセス無効（デバッグ） |
| `&nosky=1` | スカイボックス非表示（デバッグ） |
| `&nocockpit=1` | コックピット/HUD非表示（デバッグ） |

## 3. 操作キー一覧

### 操縦
| キー | 動作 |
|---|---|
| **W / S** | 機首ピッチ（下/上） |
| **A / D** | ヨー（左/右） |
| **Q / E** | ロール（左/右） |
| **Shift / Z** | スロットル上/下（-100%〜+100% 保持式） |
| **← / →** | 左右スラスター |
| **↑ / ↓** | 上下スラスター |
| **Tab** | ブースト（3秒間・加速×4・熱上昇） |

### システム
| キー | 動作 |
|---|---|
| **X** | フライトアシスト ON/OFF 切替 |
| **J** | スーパークルーズ 開始/終了 |
| **Enter** | フレームシフトドライブ充填（ハイパースペースジャンプ） |
| **H** | ヘルプパネル表示切替 |

### フライトアシスト（FA）の挙動
- **FA ON（標準）**: 入力なしで自動減速。速度は目標値へ指数的に収束（τ=0.55s）。回転はレート制御。
- **FA OFF**: ニュートン力学。推力は加速度（60 m/s²）として蓄積、慣性ドリフト持続。真空の挙動。

### スーパークルーズ中
- スロットルで速度が指数的に変化（30 km/s → 2001c）
- 天体に接近すると**重力井戸**が速度上限を強制減衰（EDと同様の減速カーテン）
- 速度表示: `km/s` → `c` → `kc` 自動切替

### ハイパースペースジャンプの流れ
1. **Enter** で FSD 充填（3秒・レティクル周囲のリングが進行）
2. トンネル突入（5秒・カメラシェイク付き）
3. 白フラッシュ → **新シードの恒星系に到着**（自動再生成）

## 4. HUD 見方

| 要素 | 位置 | 内容 |
|---|---|---|
| レティクル | 中央 | 機首方向。ジャンプ充填リングはここに表示 |
| プログレード | 緑 円+スポーク | 速度ベクトル方向（画面内のみ） |
| レトログレード | シアン 円+X | 逆速度ベクトル |
| 速度パネル | 左 | m/s / km/s / c 自動単位。SC中は kc 表示 |
| スロットル | 速度パネル右 | 縦バー（中央=0%） |
| FAランプ | 速度パネル下 | `FA ON` 緑 / `FA OFF` 点滅赤 |
| 方位テープ | 上 | 0-360°、N/E/S/W |
| NAVIGATION | 右 | 最接近天体・距離（km/Ls/AU）・高度・ターゲット一覧 |
| FUEL/HEAT | 左下 | 燃料残量・熱（>80%で赤点滅） |
| レーダー | 下中央 | 全天体を方位で配置。ステム=上下オフセット、スイープ線回転。ダッシュボード中央の凹型スキャナーウェル内に投影される |
| SC表示 | 中央 | 目的地オーブ/エッジ矢印 + 距離カウントダウン(Ls) |

## 5. QA ツール

いずれも `npm run dev` が起動していることが前提です。
要件: Google Chrome が `/Applications` に存在すること（puppeteer-core が使用）。

```bash
npm run shot                       # 全5シーン → shots/*.png
npm run shot -- start,rings        # シーン指定

npm run survey                     # 11カット（恒星の遠近・環付きガス巨大・各惑星タイプ・
                                   # 深宇宙・銀河中心・小惑星帯）→ shots/survey/*.png
SEED=42 NOCOCKPIT=1 npm run survey  # シード指定／コックピット非表示

npm run perf                       # シーンごとの FPS を計測
npm run perf -- "cockpit,cockpit|nocomposer=1"   # `|` の後は URL フラグとして付与

npm run jumptest                   # ハイパースペースジャンプを5連続実行し、
                                   # コンソールエラーと GPU リソース数の増加を検査
```

### 性能の目安（1920×1080 / headless Chrome）

| シーン | FPS |
|---|---|
| start / rings / sc | 60（vsync 上限） |
| cockpit（惑星低軌道・クレーター描画が最も重い） | 約 53 |

重い場合は `?nocomposer=1`（ポストエフェクト無効）で切り分けてください。
ブルームは半解像度で動作します（`src/engine/renderer.ts`）。

## 6. GitHub Pages への公開

公開先: **https://yukie-lab.github.io/frameshift/**

```bash
npm run deploy       # ビルド → dist/ を gh-pages ブランチへ push（Pages はここを配信）
npm run pagescheck   # dist/ を /frameshift/ 配下で静的配信して起動を検証
URL=https://yukie-lab.github.io/frameshift/ node scripts/pagescheck.mjs   # 本番URLを検証
```

`main` ブランチのルートを直接配信すると `index.html` が `/src/main.ts`（生の TypeScript）を
読みに行き、ブラウザが実行できずブート画面のまま止まります。**必ず Vite の本番ビルド
（`dist/`）を配信してください。**

`vite.config.ts` の `base` は build 時のみ `/frameshift/` になります（dev サーバーは `/` のまま
なので QA スクリプトはそのまま動きます）。リポジトリ名を変えた場合はここも合わせて変更が必要です。

## 7. トラブルシューティング

| 症状 | 対処 |
|---|---|
| 画面が真っ黒 | `?nocomposer=1` でポスト無効化して切り分け |
| シェーダーエラーがコンソールに出る | `CONSOLE:` ログを確認（screenshot.mjs が出力） |
| ポート競合 | `vite.config.ts` の port を変更 |
| Chrome が見つからない | `CHROME_PATH` 環境変数で実行ファイルを指定 |
| 起動時に一瞬止まる | 銀河をキューブマップへ1回だけ焼き込んでいます（約 0.1〜0.2 秒）。ジャンプ到着時も同様 |
| フレームレートが低い | `npm run perf` で計測。`?nosky=1` / `?nocockpit=1` で原因を切り分け |
| ブート画面から進まない | 20秒後に原因がブート画面へ赤字で表示されます。静的配信なら `dist/` を配信しているか、`base` が URL と一致しているかを確認 |

## 8. コード構造（詳細は ARCHITECTURE.md）

```
src/
  engine/    コアループ・入力・レンダラ・型契約
  physics/   飛行モデル（FA/ドリフト/ブースト）
  universe/  恒星系生成（ケプラー）・スカイボックス
  render/    惑星/環/恒星シェーダー
  ship/      コックピット・HUD
  fx/        スーパークルーズ・ハイパースペース
```

座標系: 右手系・Y-up・メートル。カメラ相対レンダリング（Game.syncScene が毎フレーム再基底化）。
