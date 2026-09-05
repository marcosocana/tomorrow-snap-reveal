import { useId, useState } from "react";
import { getCaptainSpriteCss, getCaptainSpriteVisual } from "@/lib/captainsSprite";
import type { CaptainsSpriteConfig, CaptainsSpriteStyle } from "@/lib/captainsTypes";
import "./CaptainModel.css";

type CaptainModelProps = {
  sprite?: CaptainsSpriteStyle | null;
  config?: CaptainsSpriteConfig | null;
  photoUrl?: string | null;
  className?: string;
};

/** Shared, resolution-independent sculpted character. Photos replace only the head. */
export default function CaptainModel({ sprite, config, photoUrl, className = "" }: CaptainModelProps) {
  const id = useId().replace(/:/g, "");
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const photo = Boolean(photoUrl && photoUrl !== failedPhoto);
  const visual = getCaptainSpriteVisual(sprite, config);
  const kind = visual.outfitType;
  const formal = kind === "suit" || kind === "tuxedo";
  const casual = kind === "casual";
  const longDress = kind === "long_dress";
  const fill = (name: string) => `url(#${id}-${name})`;
  return <span className={`captain-model ${visual.dressLike ? "is-dress" : "is-suit"} ${className}`} data-outfit={kind} style={getCaptainSpriteCss(sprite, config)} aria-hidden="true">
    <svg className="captain-model-art" viewBox="0 0 180 240" fill="none">
      <defs>
        <linearGradient id={`${id}-cloth`} x1="50" y1="116" x2="123" y2="175" gradientUnits="userSpaceOnUse">
          <stop stopColor={visual.outfit} /><stop offset=".25" stopColor={visual.outfit} className="captain-cloth-light" /><stop offset=".6" stopColor={visual.outfit} /><stop offset="1" stopColor={visual.outfit} className="captain-cloth-dark" />
        </linearGradient>
        <linearGradient id={`${id}-lapel`} x1="68" y1="100" x2="107" y2="150" gradientUnits="userSpaceOnUse">
          <stop stopColor={visual.outfit} className="captain-cloth-light" /><stop offset="1" stopColor={visual.outfit} />
        </linearGradient>
        <linearGradient id={`${id}-trouser`} x1="64" y1="182" x2="116" y2="197" gradientUnits="userSpaceOnUse">
          <stop stopColor={visual.legs} className="captain-legs-light" /><stop offset=".46" stopColor={visual.legs} /><stop offset="1" stopColor={visual.legs} className="captain-legs-dark" />
        </linearGradient>
        <radialGradient id={`${id}-skin`} cx=".3" cy=".24" r=".85">
          <stop stopColor={visual.skin} className="captain-skin-light" /><stop offset=".56" stopColor={visual.skin} /><stop offset="1" stopColor={visual.skin} className="captain-skin-dark" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="54" y1="24" x2="125" y2="80" gradientUnits="userSpaceOnUse">
          <stop stopColor={visual.hair} className="captain-hair-light" /><stop offset=".48" stopColor={visual.hair} /><stop offset="1" stopColor={visual.hair} className="captain-hair-dark" />
        </linearGradient>
        <linearGradient id={`${id}-shoe`} x1="0" y1="0" x2=".65" y2="1">
          <stop stopColor="#6f6460" /><stop offset=".4" stopColor="#332c2d" /><stop offset="1" stopColor="#171417" />
        </linearGradient>
        <linearGradient id={`${id}-shirt`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffef9" /><stop offset=".55" stopColor="#f0e8df" /><stop offset="1" stopColor="#b7aaa3" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff0c0" /><stop offset=".4" stopColor="#e8bd70" /><stop offset="1" stopColor="#9e6938" />
        </linearGradient>
        <linearGradient id={`${id}-band`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffb0a3" /><stop offset=".4" stopColor="#f06a5f" /><stop offset="1" stopColor="#a83e38" />
        </linearGradient>
        <radialGradient id={`${id}-ground`}><stop stopColor="#4b302b" stopOpacity=".26" /><stop offset="1" stopColor="#4b302b" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="91" cy="225" rx="63" ry="12" fill={fill("ground")} />
      <g strokeLinejoin="round" strokeLinecap="round">
        {/* Rounded trousers, stitched seams and polished shoes. */}
        <path d="M61 166h28l-3 46c-5 5-16 5-23 1l-4-33Z" fill={visual.dressLike ? fill("skin") : fill("trouser")} />
        <path d="M93 166h27l-3 48c-7 4-17 3-22-1l-3-34Z" fill={visual.dressLike ? fill("skin") : fill("trouser")} />
        {!visual.dressLike && <><path d="m72 180 1 27m31-27 1 28" stroke="#fff" strokeOpacity=".13" strokeWidth="2" /><path d="M62 206h23m10 1h22" stroke="#000" strokeOpacity=".16" /></>}
        {kind === "jumpsuit" && <path d="M60 158h28l-2 53H57Zm33 0h29l2 53H95Z" fill={fill("cloth")} />}
        <path d="M62 207c7 3 15 3 23 0l2 11c0 6-9 8-23 8-9 0-12-4-9-9Z" fill={casual ? fill("shirt") : fill("shoe")} />
        <path d="M96 207c7 3 15 3 22 0l9 11c3 7-7 9-20 8-9 0-14-3-13-8Z" fill={casual ? fill("shirt") : fill("shoe")} />
        <path d="M57 222c9 3 21 2 28 0m12 0c9 3 22 3 29 0" stroke="#121014" strokeWidth="2" />
        <path d="m64 213 10-1m31 1 9 1" stroke="#fff" strokeOpacity=".33" strokeWidth="2" />
        {/* Sleeves curve away from the torso; hands have separate thumbs. */}
        <path d="M60 108c-9-2-17 4-20 14l-9 33c-1 6 13 10 17 3l15-28Z" fill={casual ? fill("skin") : fill("cloth")} />
        <path d="M121 109c9-2 16 5 19 14l8 32c2 7-13 11-17 4l-14-29Z" fill={casual ? fill("skin") : fill("cloth")} />
        {casual && <path d="M61 106c-11-1-19 7-23 22l-2 9 18 5 10-26Zm57 1c12-1 20 9 23 21l3 10-18 5-10-27Z" fill={fill("cloth")} />}
        <path d="m43 121-8 31m100-29 8 28" stroke="#fff" strokeOpacity=".17" strokeWidth="2.5" />
        {!casual && <path d="m32 153 16 5-2 7-16-5Zm99 6 16-5 2 7-16 5Z" fill={formal ? fill("shirt") : fill("lapel")} />}
        <path d="M31 161c-6 5-6 17 1 20 5 3 10-2 11-9 4 1 7-3 5-6l-4-4Z" fill={fill("skin")} />
        <path d="M147 162c6 4 7 16 0 20-6 3-10-2-11-8-4 0-7-3-5-7l4-4Z" fill={fill("skin")} />
        <path d="m33 169-1 6m112-5 1 6" stroke="#733c2a" strokeOpacity=".22" strokeWidth="1.5" />
        <path d="M78 86h25l3 21-15 12-16-12Z" fill={fill("skin")} />
        {visual.dressLike ? <>
          <path d={longDress
            ? "M68 103 77 99c5 13 23 14 29 0l11 5c10 8 8 21 1 34l-1 8 23 61c-25 12-72 12-99 0l23-61-1-9c-7-17-7-27 5-33Z"
            : "M68 103 77 99c5 13 23 14 29 0l11 5c10 8 8 21 1 34l-1 8 19 45c-19 13-69 14-91 0l19-45-1-9c-7-17-7-27 5-33Z"} fill={fill("cloth")} />
          {kind === "skirt" ? <>
            <path d="M65 140c16 4 35 4 51 0l20 51c-25 13-66 12-91 0Z" fill={fill("trouser")} />
            <path d="m78 100 13 13 13-13-4 20-9-7-9 7Z" fill={fill("shirt")} />
            <path d="M91 117v21" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
            <circle cx="91" cy="123" r="1.5" fill={fill("gold")} /><circle cx="91" cy="133" r="1.5" fill={fill("gold")} />
          </> : <path d="M76 103c7 13 25 13 31 0" stroke={fill("gold")} strokeWidth="2" />}
          <path d="M66 137c15 5 33 5 50 0l1 8c-17 5-35 5-53 0Z" fill={kind === "skirt" ? fill("trouser") : fill("lapel")} />
          <rect x="85" y="138" width="12" height="8" rx="2" stroke={fill("gold")} strokeWidth="2" />
          <path d={longDress ? "m71 151-15 53m26-50-4 53m20-53 5 53m7-56 16 53" : "m71 151-11 37m22-34-3 39m19-39 4 38m8-41 13 37"} stroke="#fff" strokeOpacity=".14" strokeWidth="3" />
          <path d={longDress ? "M46 206c27 10 61 10 89-1" : "M50 190c24 10 57 10 80-1"} stroke="#000" strokeOpacity=".15" strokeWidth="2" />
        </> : formal ? <>
          <path d="M72 101c12-5 25-5 37 0l13 7c9 15 4 43 4 61l-3 9c-10 5-23 3-33-1-10 5-26 5-34 0l-2-10c0-21-5-45 4-59Z" fill={fill("cloth")} />
          <path d="m75 102 15 51 17-51-16-6Z" fill={fill("shirt")} />
          <path d="m76 98 14 12-10 9-9-16m34-5-15 12 12 9 8-16" fill={fill("shirt")} stroke="#c3b6ad" strokeWidth=".7" />
          {kind === "tuxedo" ? <>
            <path d="m89 114-11-6v13l11-4 12 4v-13Z" fill={visual.accent} />
            <rect x="87" y="112" width="6" height="7" rx="2" fill={visual.accent} stroke="#fff" strokeOpacity=".3" />
            <path d="M89 126v19" stroke="#b7aaa3" /><circle cx="89" cy="130" r="1.5" fill="#332c2d" /><circle cx="89" cy="141" r="1.5" fill="#332c2d" />
          </> : <>
            <path d="m87 112-4 7 5 27 5 5 5-7-7-25 4-7Z" fill={visual.accent} />
            <path d="m88 122 3 19" stroke="#fff" strokeOpacity=".28" strokeWidth="2" />
          </>}
          <path d={kind === "tuxedo" ? "M72 101c-17 14-10 36 18 57l-13-55Zm36 0c19 15 11 36-18 57l14-55Z" : "m70 103-7 17 9 4-5 7 23 27-12-55Zm41 0 8 17-10 5 6 7-25 26 15-54Z"} fill={fill("lapel")} stroke="#fff" strokeOpacity=".14" strokeWidth=".8" />
          <path d="m90 158-1 18m-25-23 13 1m27 0 13-2" stroke="#000" strokeOpacity=".2" strokeWidth="1.5" />
          <path d="m106 129 9-1-1 5-9 1Z" fill={fill("shirt")} />
          <path d="m103 134 13-1" stroke="#fff" strokeOpacity=".28" />
          <circle cx="91" cy="159" r="2.4" fill={fill("gold")} /><circle cx="91" cy="170" r="2.2" fill={fill("gold")} />
        </> : <>
          <path d={kind === "jumpsuit" ? "M74 101c11-6 25-5 34 0l15 10-2 39 2 30H57l2-30-3-39Z" : "M74 101c11-6 25-5 34 0l15 10-1 61c-21 7-44 7-65 0l-1-61Z"} fill={fill("cloth")} />
          {casual ? <>
            <path d="M76 102c1 17 28 17 29 0" stroke={fill("lapel")} strokeWidth="6" />
            <path d="M60 168q30 5 60 0" stroke="#fff" strokeOpacity=".2" strokeWidth="2" />
            <path d="m107 132 6 8-9 2-4-6Z" fill={fill("shirt")} />
          </> : kind === "jumpsuit" ? <>
            <path d="m77 101 14 26 14-26" fill={fill("skin")} />
            <path d="m74 103 17 28 17-28M91 131v21" stroke="#fff" strokeOpacity=".3" strokeWidth="2" />
            <path d="M59 150q31 7 64 0v7q-32 7-64 0Z" fill={fill("lapel")} />
            <rect x="85" y="151" width="13" height="8" rx="2" stroke={fill("gold")} strokeWidth="2" />
          </> : <>
            <path d="m76 100 15 12-10 9-9-17m34-4-15 12 12 9 7-17" fill={fill("lapel")} stroke="#fff" strokeOpacity=".4" />
            <path d="M91 116v52" stroke="#fff" strokeOpacity=".25" strokeWidth="2" />
            {[127, 139, 151, 163].map(y => <circle key={y} cx="91" cy={y} r="1.6" fill={fill("shirt")} />)}
            <path d="M104 128h12v12l-6 4-6-4Z" stroke="#fff" strokeOpacity=".3" />
          </>}
        </>}
        {/* Every captain wears a tiny enamel captain's armband. */}
        <path d="m131 130 13-4 3 13-13 4Z" fill={fill("band")} stroke="#a94940" strokeWidth=".8" />
        <path d="m133 132 10-3m-7 11 9-3" stroke="#ffd5bc" strokeWidth=".7" />
        <circle cx="139" cy="134" r="4" fill={fill("gold")} />
        <path d="M140 132c-4-1-4 5 0 4" stroke="#9c4235" strokeWidth="1.2" />
        {!photo && <>
          {visual.longHair && <path d="M49 49c-2-39 82-40 84 0l5 50c-7 14-25 15-34 5H76c-12 11-30 5-31-5Z" fill={fill("hair")} />}
          <ellipse cx="49" cy="61" rx="8" ry="12" fill={fill("skin")} /><ellipse cx="131" cy="61" rx="8" ry="12" fill={fill("skin")} />
          <path d="M49 45c0-43 82-43 82 0v18c0 23-18 36-41 36S49 85 49 63Z" fill={fill("skin")} />
          <ellipse cx="69" cy="68" rx="9" ry="5" fill="#e78e7f" opacity=".3" /><ellipse cx="112" cy="68" rx="9" ry="5" fill="#e78e7f" opacity=".3" />
          <path d="M63 51q7-4 13-1m28 0q7-3 13 1" stroke={visual.hair} strokeWidth="3" />
          <ellipse cx="71" cy="61" rx="4" ry="5" fill="#332b29" /><ellipse cx="110" cy="61" rx="4" ry="5" fill="#332b29" />
          <circle cx="70" cy="59" r="1.3" fill="#fff" /><circle cx="109" cy="59" r="1.3" fill="#fff" />
          <path d="M88 63q-5 10 4 9" stroke="#9f6144" strokeOpacity=".4" strokeWidth="2" />
          <path d="M78 80q12 9 24-1" stroke="#9b5548" strokeWidth="2.5" /><path d="m83 81 13-1" stroke="#ffebdc" strokeWidth="2" />
          <path d={visual.longHair ? "M47 58C35 4 82 3 96 12c29-8 45 14 37 47l-11-9-4-19c-15 8-25 0-28-7-7 13-20 20-35 19l-2 16Z" : "M48 58C35 22 53 5 78 12c15-14 30-4 35 2 20-2 28 14 20 43l-10-9-4-17c-24 16-36 13-54 9l-8 18Z"} fill={fill("hair")} />
          <path d="M57 28c14-12 36-9 43-6m-37 9c10-5 20-5 27-6" stroke="#fff" strokeOpacity=".15" strokeWidth="2.5" />
        </>}
      </g>
    </svg>
    {photo && <span className="captain-model-photo cv2-photo-head"><img src={photoUrl!} alt="" decoding="async" onError={() => setFailedPhoto(photoUrl!)} /></span>}
  </span>;
}
