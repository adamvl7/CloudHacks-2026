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

export async function getRegions() {
  const { data } = await client.get('/regions')
  return data
}

export async function getGridCurrent(region) {
  const { data } = await client.get('/grid/current', { params: { region } })
  return data
}

export async function getGridHistory(region) {
  const { data } = await client.get('/grid/history', { params: { region } })
  return data
}

export async function getPowerBreakdown(region) {
  try {
    const { data } = await client.get('/power-breakdown', { params: { region } })
    return data
  } catch {
    return null
  }
}

export async function getForecast(region) {
  try {
    const { data } = await client.get('/forecast', { params: { region } })
    return data // { zone, threshold, forecast: [{ datetime, carbonIntensity }] }
  } catch {
    return null
  }
}

export async function getRegionCompare(region) {
  try {
    const { data } = await client.get('/region-compare', { params: { region } })
    return data // { current_zone, regions: [{ zone, carbonIntensity, label }] }
  } catch {
    return null
  }
}
