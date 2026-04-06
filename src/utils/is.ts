const toString = Object.prototype.toString;

export const isString = (val: any): boolean => {
    return toString.call(val) === '[object String]';
}

export const isNumber = (val: any): boolean => {
    return toString.call(val) === '[object Number]';
}

export const isArray = (val: any): boolean => {
    return toString.call(val) === '[object Array]';
}       

export const isObj = (val: any): boolean =>{ 
    return toString.call(val) === '[object Object]';
} 
