/**
 * OCR 服务统一接口
 * 支持多个 OCR 服务商：腾讯、百度、阿里云、Google
 */

import { OCRProvider, OCRRecognizeResult, OCRConfig } from '@/types/handwriting'

// 获取默认 OCR 配置
function getOCRConfig(): OCRConfig {
  const provider = (process.env.OCR_PROVIDER || 'tencent') as OCRProvider

  const config: OCRConfig = { provider }

  // 腾讯云配置
  if (provider === 'tencent' || !config.tencent) {
    config.tencent = {
      secretId: process.env.TENCENT_OCR_SECRET_ID || '',
      secretKey: process.env.TENCENT_OCR_SECRET_KEY || '',
      region: process.env.TENCENT_OCR_REGION || 'ap-guangzhou'
    }
  }

  // 百度云配置
  if (provider === 'baidu') {
    config.baidu = {
      apiKey: process.env.BAIDU_OCR_API_KEY || '',
      secretKey: process.env.BAIDU_OCR_SECRET_KEY || ''
    }
  }

  // 阿里云配置
  if (provider === 'aliyun') {
    config.aliyun = {
      accessKeyId: process.env.ALIYUN_OCR_ACCESS_KEY_ID || '',
      accessKeySecret: process.env.ALIYUN_OCR_ACCESS_KEY_SECRET || '',
      endpoint: process.env.ALIYUN_OCR_ENDPOINT || 'ocr-api.cn-hangzhou.aliyuncs.com'
    }
  }

  // Google Cloud 配置
  if (provider === 'google') {
    config.google = {
      apiKey: process.env.GOOGLE_OCR_API_KEY || ''
    }
  }

  return config
}

/**
 * 统一的 OCR 识别接口
 */
export async function recognizeHandwriting(
  imageBase64: string,
  provider?: OCRProvider
): Promise<OCRRecognizeResult> {
  const config = getOCRConfig()
  const selectedProvider = provider || config.provider

  console.log(`[OCR] 使用 ${selectedProvider} 进行识别`)

  // 根据配置调用对应的服务商
  switch (selectedProvider) {
    case 'tencent':
      return recognizeWithTencent(imageBase64, config.tencent!)
    case 'baidu':
      return recognizeWithBaidu(imageBase64, config.baidu!)
    case 'aliyun':
      return recognizeWithAliyun(imageBase64, config.aliyun!)
    case 'google':
      return recognizeWithGoogle(imageBase64, config.google!)
    default:
      throw new Error(`不支持的 OCR 服务商: ${selectedProvider}`)
  }
}

/**
 * 腾讯云 OCR 识别
 */
async function recognizeWithTencent(
  imageBase64: string,
  config: { secretId: string; secretKey: string; region?: string }
): Promise<OCRRecognizeResult> {
  const crypto = require('crypto')
  const axios = require('axios')

  // 移除 base64 前缀
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  // 腾讯云 API 参数
  const endpoint = 'ocr.tencentcloudapi.com'
  const action = 'GeneralHandwritingOCR'
  const version = '2018-11-19'
  const timestamp = Math.floor(Date.now() / 1000)

  // 构建请求参数
  const params = {
    ImageBase64: base64Data,
    Scene: 'Class'
  }

  // 计算签名
  const payload = JSON.stringify(params)
  const hash = crypto.createHash('sha256').update(payload).digest('hex')

  const authorization = await calculateAuthorization({
    secretId: config.secretId,
    secretKey: config.secretKey,
    endpoint,
    action,
    version,
    timestamp,
    payloadHash: hash
  })

  try {
    const response = await axios.post(
      `https://${endpoint}`,
      params,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorization,
          'Host': endpoint,
          'X-TC-Action': action,
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Version': version,
          'X-TC-Region': config.region || 'ap-guangzhou'
        }
      }
    )

    if (response.data.Response.Error) {
      throw new Error(`腾讯云 OCR 错误: ${response.data.Response.Error.Message}`)
    }

    const textDetections = response.data.Response.TextDetections || []
    const text = textDetections.map((d: any) => d.DetectedText).join('')

    return {
      text,
      confidence: 0.9, // 腾讯云不返回置信度，给默认值
      provider: 'tencent'
    }
  } catch (error: any) {
    console.error('[腾讯云 OCR] 识别失败:', error.message)
    throw new Error(`腾讯云 OCR 识别失败: ${error.message}`)
  }
}

/**
 * 计算腾讯云 API 签名
 */
async function calculateAuthorization({
  secretId,
  secretKey,
  endpoint,
  action,
  version,
  timestamp,
  payloadHash
}: {
  secretId: string
  secretKey: string
  endpoint: string
  action: string
  version: string
  timestamp: number
  payloadHash: string
}): Promise<string> {
  const crypto = require('crypto')

  const date = new Date(timestamp * 1000).toISOString().substr(0, 10)
  const service = endpoint.split('.')[0]

  // 构建签名原文
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\n`
  const signedHeaders = 'content-type;host'
  const requestPayload = payloadHash

  const canonicalRequest =
    httpRequestMethod +
    '\n' +
    canonicalUri +
    '\n' +
    canonicalQueryString +
    '\n' +
    canonicalHeaders +
    '\n' +
    signedHeaders +
    '\n' +
    requestPayload

  const credentialScope = `${date}/${service}/tc3_request`
  const hashedCanonicalRequest = crypto
    .createHash('sha256')
    .update(canonicalRequest)
    .digest('hex')

  const stringToSign =
    'TC3-HMAC-SHA256\n' +
    timestamp +
    '\n' +
    credentialScope +
    '\n' +
    hashedCanonicalRequest

  // 计算签名
  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest()
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex')

  // 构建授权信息
  const authorization =
    'TC3-HMAC-SHA256 ' +
    'Credential=' +
    secretId +
    '/' +
    credentialScope +
    ', ' +
    'SignedHeaders=' +
    signedHeaders +
    ', ' +
    'Signature=' +
    signature

  return authorization
}

/**
 * 百度云 OCR 识别
 */
async function recognizeWithBaidu(
  imageBase64: string,
  config: { apiKey: string; secretKey: string }
): Promise<OCRRecognizeResult> {
  let accessToken = await getBaiduAccessToken(config.apiKey, config.secretKey)

  // 移除 base64 前缀
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')

  try {
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `image=${encodeURIComponent(base64Data)}`
      }
    )

    const data = await response.json()

    if (data.error_code) {
      // token 过期，重新获取
      if (data.error_code === 110 || data.error_code === 111) {
        accessToken = await getBaiduAccessToken(config.apiKey, config.secretKey, true)
        // 重试
        return recognizeWithBaidu(imageBase64, config)
      }
      throw new Error(`百度云 OCR 错误: ${data.error_msg}`)
    }

    const words = data.words_result || []
    const text = words.map((w: any) => w.words).join('')
    const confidence = words[0]?.probability || 0.9

    return {
      text,
      confidence,
      provider: 'baidu'
    }
  } catch (error: any) {
    console.error('[百度云 OCR] 识别失败:', error.message)
    throw new Error(`百度云 OCR 识别失败: ${error.message}`)
  }
}

// 百度 access_token 缓存
let baiduAccessTokenCache: { token: string; expireAt: number } | null = null

/**
 * 获取百度 access_token
 */
async function getBaiduAccessToken(
  apiKey: string,
  secretKey: string,
  forceRefresh = false
): Promise<string> {
  // 检查缓存
  if (!forceRefresh && baiduAccessTokenCache && Date.now() < baiduAccessTokenCache.expireAt) {
    return baiduAccessTokenCache.token
  }

  try {
    const response = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`
    )

    const data = await response.json()

    if (data.error) {
      throw new Error(`获取百度 access_token 失败: ${data.error_description}`)
    }

    // 缓存 token（有效期 30 天，提前 1 小时过期）
    baiduAccessTokenCache = {
      token: data.access_token,
      expireAt: Date.now() + (data.expires_in - 3600) * 1000
    }

    return data.access_token
  } catch (error: any) {
    console.error('[百度云] 获取 access_token 失败:', error.message)
    throw error
  }
}

/**
 * 阿里云 OCR 识别
 */
async function recognizeWithAliyun(
  imageBase64: string,
  config: { accessKeyId: string; accessKeySecret: string; endpoint?: string }
): Promise<OCRRecognizeResult> {
  // 阿里云需要安装 @alicloud/pop-core 包
  // 这里提供简化的实现示例

  throw new Error('阿里云 OCR 暂未实现，请使用腾讯云或百度云')
}

/**
 * Google Cloud OCR 识别
 */
async function recognizeWithGoogle(
  imageBase64: string,
  config: { apiKey: string }
): Promise<OCRRecognizeResult> {
  // Google Cloud Vision API
  throw new Error('Google Cloud OCR 暂未实现，请使用腾讯云或百度云')
}
