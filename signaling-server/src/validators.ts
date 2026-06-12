export const isValidRoomId = (id: any): boolean => {
  return typeof id === 'string' && id.length>0 && id.length<=64;
};

export const isValidSDP = (data: any): boolean => {
  return data && typeof data.type === 'string' && typeof data.sdp === 'string';
};

export const isValidCandidate = (data: any): boolean => {
  return data && typeof data.candidate === 'string';
};
