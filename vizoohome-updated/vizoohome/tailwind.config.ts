import type { Config } from "tailwindcss";
export default { content:["./app/**/*.tsx","./components/**/*.tsx"],
 theme:{extend:{colors:{navy:"#0B192C",amber:"#FF9D23",soft:"#F8FAFC",ink:"#1E293B",mute:"#64748B",line:"#E2E8F0"},maxWidth:{site:"1280px"}}},plugins:[]} satisfies Config;
