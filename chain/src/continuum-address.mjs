import { createHash, timingSafeEqual } from "node:crypto";

export const NOVA_REALM_ID=Buffer.from("ec7601ee487ab2bd2d076e41009ca780","hex");
export const NCA_VERSION=1;
const ALPHABET="0123456789abcdefghjkmnpqrstvwxyz",ALPHABET_MAP=new Map([...ALPHABET].map((character,index)=>[character,index])),NETWORK={mainnet:0,testnet:1,private:2},NETWORK_CODE=["m","t","p"],OBJECT={account:1,validator:2,transaction:3,block:4},OBJECT_CODE={account:"a",validator:"v",transaction:"x",block:"b"},CHECKSUM_SUITE=1,CORE_LENGTH=52,CHECKSUM_LENGTH=16;
const digest=input=>createHash("sha512-256").update(input).digest(),checksum=core=>digest(Buffer.concat([Buffer.from("NOVA:NCA:CHECKSUM:1\0"),core])).subarray(0,CHECKSUM_LENGTH);
const convertBits=(values,fromBits,toBits,pad)=>{let accumulator=0,bits=0;const result=[],maxValue=(1<<toBits)-1,maxAccumulator=(1<<(fromBits+toBits-1))-1;for(const value of values){if(value<0||(value>>fromBits)!==0)throw new Error("invalid NCA data range");accumulator=((accumulator<<fromBits)|value)&maxAccumulator;bits+=fromBits;while(bits>=toBits){bits-=toBits;result.push((accumulator>>>bits)&maxValue)}}if(pad){if(bits)result.push((accumulator<<(toBits-bits))&maxValue)}else if(bits>=fromBits||((accumulator<<(toBits-bits))&maxValue)!==0)throw new Error("invalid NCA padding");return result};
const encodeN32=bytes=>convertBits(bytes,8,5,true).map(value=>ALPHABET[value]).join(""),decodeN32=text=>Buffer.from(convertBits([...text].map(character=>{const value=ALPHABET_MAP.get(character);if(value===undefined)throw new Error("invalid NCA character");return value}),5,8,false));
const group=text=>text.match(/.{1,8}/g).join("-");
const reverseLookup=(table,value)=>Object.entries(table).find(([,item])=>item===value)?.[0];

export function encodeContinuumId(identifier,{network="mainnet",type="account"}={}){
  const id=Buffer.from(identifier);if(id.length!==32)throw new Error("NCA identifier requires 256 bits");if(NETWORK[network]===undefined)throw new Error("unsupported NCA network");if(OBJECT[type]===undefined)throw new Error("unsupported NCA object type");
  const core=Buffer.concat([Buffer.from([NCA_VERSION,NETWORK[network],OBJECT[type],CHECKSUM_SUITE]),NOVA_REALM_ID,id]),body=group(encodeN32(Buffer.concat([core,checksum(core)])));
  return `nva-${NETWORK_CODE[NETWORK[network]]}-${OBJECT_CODE[type]}${NCA_VERSION}-${body}`;
}
export function decodeContinuumId(value,{type}={}){
  if(typeof value!=="string"||value!==value.toLowerCase()||value.length>160)throw new Error("invalid NCA casing or length");const parts=value.split("-");if(parts.length<5||parts[0]!=="nva")throw new Error("invalid NCA namespace");const networkIndex=NETWORK_CODE.indexOf(parts[1]),objectCode=parts[2][0],textVersion=Number(parts[2].slice(1)),body=parts.slice(3).join("");if(networkIndex<0||!Number.isInteger(textVersion))throw new Error("invalid NCA header");if(parts.slice(3,-1).some(part=>part.length!==8)||parts.at(-1).length>8)throw new Error("invalid NCA grouping");
  const decoded=decodeN32(body);if(decoded.length!==CORE_LENGTH+CHECKSUM_LENGTH)throw new Error("invalid NCA payload length");const core=decoded.subarray(0,CORE_LENGTH),provided=decoded.subarray(CORE_LENGTH),version=core[0],network=reverseLookup(NETWORK,core[1]),objectType=reverseLookup(OBJECT,core[2]);if(version!==NCA_VERSION||version!==textVersion)throw new Error("unsupported NCA version");if(!network||NETWORK_CODE[core[1]]!==parts[1])throw new Error("NCA network mismatch");if(!objectType||OBJECT_CODE[objectType]!==objectCode)throw new Error("NCA object mismatch");if(type&&objectType!==type)throw new Error(`expected NCA ${type}`);if(core[3]!==CHECKSUM_SUITE)throw new Error("unsupported NCA checksum suite");if(!core.subarray(4,20).equals(NOVA_REALM_ID))throw new Error("foreign NOVA realm");if(!timingSafeEqual(provided,checksum(core)))throw new Error("invalid NCA checksum");
  return{version,network,type:objectType,checksumSuite:core[3],realmId:core.subarray(4,20),identifier:core.subarray(20,52)};
}
export function isPaymentAddress(value){try{decodeContinuumId(value,{type:"account"});return true}catch{return false}}
export function accountStateKey(value){return `a:${decodeContinuumId(value,{type:"account"}).identifier.toString("hex")}`}
export function validatorDisplayId(account){const decoded=decodeContinuumId(account,{type:"account"});return encodeContinuumId(decoded.identifier,{network:decoded.network,type:"validator"})}
export function transactionDisplayId(hash,{network="mainnet"}={}){if(!/^[a-f0-9]{64}$/.test(hash))throw new Error("transaction hash must contain 256 bits");return encodeContinuumId(Buffer.from(hash,"hex"),{network,type:"transaction"})}
export function blockDisplayId(hash,{network="mainnet"}={}){if(!/^[a-f0-9]{64}$/.test(hash))throw new Error("block hash must contain 256 bits");return encodeContinuumId(Buffer.from(hash,"hex"),{network,type:"block"})}
export function suggestSingleSymbolCorrections(value,limit=4){if(typeof value!=="string"||value.length>160)return[];const suggestions=[];for(let index=0;index<value.length&&suggestions.length<limit;index++){if(value[index]==="-")continue;for(const replacement of ALPHABET){if(replacement===value[index])continue;const candidate=`${value.slice(0,index)}${replacement}${value.slice(index+1)}`;try{decodeContinuumId(candidate);suggestions.push(candidate);break}catch{}}}return suggestions}
