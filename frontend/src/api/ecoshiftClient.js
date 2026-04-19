import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

const client = axios.create({ baseURL, timeout: 10_000 })

export async function getCurrent() {
  const { data } = await client.get('/current')
  return data
}

export async function getDecisions(hours = 24) {
  const { data } = await client.get('/decisions', { params: { hours } })
  return data.decisions || []
}

export async function getLatestSummary() {
  try {
    const { data } = await client.get('/summary/latest')
    return data
  } catch (err) {
    if (err.response?.status === 404) return null
    throw err
  }
}

export async function generateSummary() {
  const { data } = await client.post('/summary/generate', {}, { timeout: 60_000 })
  return data
}

export async function getPowerBreakdown() {
  try {
    const { data } = await client.get('/power-breakdown')
    return data
  } catch {
    return null
  }
}

export async function getForecast() {
  try {
    const { data } = await client.get('/forecast')
    return data // { zone, threshold, forecast: [{ datetime, carbonIntensity }] }
  } catch {
    return null
  }
}

export async function getRegionCompare() {
  try {
    const { data } = await client.get('/region-compare')
    return data // { current_zone, regions: [{ zone, carbonIntensity, label }] }
  } catch {
    return null
  }
}
