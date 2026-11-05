export function PetArt({ single }: { single?: "dog" | "cat" }) {
  const dog = (
    <g>
      <path d="M122 184c-24-21-30-54-16-68 16-12 35 9 39 29" fill="#D88E4C" />
      <ellipse cx="181" cy="216" rx="75" ry="73" fill="#E9AB68" />
      <path
        d="M159 175c-24 15-37 59-29 90 17 19 57 25 88 8 4-30-9-79-35-98"
        fill="#FFF9EF"
      />
      <path
        d="M121 126c-17-29-28-67-17-80 14-7 40 25 48 50M204 94c9-29 35-57 46-50 12 13 4 53-12 81"
        fill="#DC995A"
      />
      <path
        d="M119 92c-8-16-13-30-11-33 7 0 20 17 27 32M221 90c7-16 19-29 23-30 1 9-5 26-12 38"
        fill="#EFBE98"
      />
      <path
        d="M111 119c9-34 43-45 70-44 42-1 69 19 72 50 14 46-16 77-67 79-54 0-93-25-75-85Z"
        fill="#E9AB68"
      />
      <path
        d="M178 78c-3 20-13 33-17 50-9 9-28 6-41 16-12 19 8 47 50 50 46 7 73-14 72-33-2-16-27-20-39-33-12-12-13-32-17-50"
        fill="#FFF9EF"
      />
      <ellipse cx="145" cy="130" rx="4.5" ry="6" fill="#4B3E33" />
      <ellipse cx="215" cy="129" rx="4.5" ry="6" fill="#4B3E33" />
      <path
        d="M170 148c-1-8 22-8 22-1 0 5-8 10-11 10s-10-4-11-9Z"
        fill="#554337"
      />
      <path
        d="M181 157v8m0 0c-9 6-16 1-17-3m17 3c7 6 15 2 17-3"
        fill="none"
        stroke="#685044"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M173 168c2 15 17 15 19-1" fill="#DE9081" />
      <ellipse cx="131" cy="148" rx="10" ry="5" fill="#E79C7E" opacity=".6" />
      <ellipse cx="227" cy="147" rx="10" ry="5" fill="#E79C7E" opacity=".6" />
      <path
        d="M129 231c-9 8-17 33-12 46 8 8 24 9 32 1l7-41M209 235l4 43c10 10 26 7 30-1 3-17-6-38-15-46"
        fill="#FFF9EF"
      />
      <path
        d="m127 276 1 7m9-7v7m86-7 1 7m8-8v7"
        stroke="#D9C2A8"
        strokeWidth="1.6"
      />
      <path
        d="M145 195c21 10 46 12 68-1"
        fill="none"
        stroke="#A7764F"
        strokeWidth="7"
      />
      <circle cx="181" cy="205" r="9" fill="#EFC471" />
      <path
        d="m178 205 2 2 4-5"
        fill="none"
        stroke="#A9793D"
        strokeWidth="1.5"
      />
    </g>
  )
  const cat = (
    <g>
      <path
        d="M322 252c55 16 61-26 47-33-9-5-14 10-25 9"
        fill="none"
        stroke="#A7AFAB"
        strokeWidth="21"
        strokeLinecap="round"
      />
      <ellipse cx="298" cy="231" rx="49" ry="54" fill="#CAD0C9" />
      <path
        d="M280 193c-15 14-18 47-14 76 18 14 41 14 56 0 0-30-5-63-21-76"
        fill="#FCFCF4"
      />
      <path
        d="m250 151-3-58c0-6 4-7 9-3l33 25m16-2 31-25c4-4 9-3 9 3l-3 63"
        fill="#A8B3AE"
      />
      <path d="m256 119-1-17 17 17m49-1 16-16-2 21" fill="#D3B6AD" />
      <path
        d="M245 147c4-23 21-37 49-37 30-1 50 15 54 37 5 35-18 58-53 58-35 0-59-23-50-58Z"
        fill="#CBD1CB"
      />
      <path
        d="M290 115c-2 20-9 29-16 36-14 0-23 8-20 20 6 20 24 28 41 28 22-1 39-12 43-27 2-13-13-20-23-22-6-10-12-20-14-35"
        fill="#FCFCF4"
      />
      <path
        d="m265 148 8 1m45 0 8-2"
        stroke="#566E65"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="m288 164 7 5 7-5c-3-5-11-5-14 0Z" fill="#BF9B91" />
      <path
        d="M295 170v5m0 0c-6 4-10 1-11-1m11 1c5 4 9 1 11-1"
        stroke="#7A7F72"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="m274 170-27-4m26 11-28 3m69-10 28-5m-28 12 29 2"
        stroke="#919D90"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M265 247v27c2 7 14 8 22 3l2-30m17 0 2 29c7 6 19 5 21-2v-24"
        fill="#FCFCF4"
      />
      <path
        d="M271 201c14 6 34 6 46-1"
        stroke="#CF9E79"
        strokeWidth="5"
        fill="none"
      />
      <circle cx="295" cy="209" r="6" fill="#D5B27A" />
    </g>
  )
  if (single)
    return (
      <svg
        viewBox={single === "dog" ? "83 38 180 255" : "235 80 145 210"}
        aria-hidden="true"
      >
        {single === "dog" ? dog : cat}
      </svg>
    )
  return (
    <svg
      viewBox="0 0 450 330"
      fill="none"
      className="pet-art-svg"
      aria-label="安心相伴的柯基和布偶猫插画"
      role="img"
    >
      <path
        d="M52 256c-14-47 7-94 40-119-8-61 36-115 102-112 34-20 100-8 112 38 58-5 105 51 86 98 24 32 20 70-12 98Z"
        fill="#F9E6CF"
        opacity=".7"
      />
      <ellipse
        cx="232"
        cy="285"
        rx="159"
        ry="13"
        fill="#E6CBAB"
        opacity=".35"
      />
      <path
        d="M72 245c-6-17-4-33 1-43m1 28c-12-5-19-15-19-24 11 0 19 11 19 24m0-10c8-5 13-14 12-21-9 3-13 11-12 21"
        stroke="#A5AE88"
        strokeWidth="2"
        fill="#C6CFB1"
      />
      {dog}
      {cat}
      <path
        d="M330 51c6-12 21-6 17 5l-18 15-10-19c-3-12 9-14 11-1Z"
        fill="#E8AE85"
      />
      <path
        d="m79 116 4-7m-17 5 5 3m291-20 6-4m-1 16 7 1"
        stroke="#CFAB82"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="114" cy="38" r="3" fill="#E0B889" />
      <circle cx="393" cy="194" r="3" fill="#E0B889" />
    </svg>
  )
}
