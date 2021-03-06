const axios = require('axios')
const cheerio = require('cheerio')
const { shortTitleDrakorasia } = require('helpers/values')
const { CustomMessage } = require('helpers/CustomMessage')

class DrakorasiaController {
    constructor(req, res) {
        this.request = req
        this.response = res
    }

    async controller() {
        const { request, response } = this
        const { search } = request.query

        if (!search) {
            return new CustomMessage(response).error({
                status_code: 400,
                message: 'Silahkan isi query search, contoh ?search=tale',
            }, 400)
        }

        const keyword = search.replace(/ /g, '+')
        const url = `https://drakorasia.net/?s=${keyword}&post_type=post`

        try {
            // search page
            const responseSearch = await axios.get(url)
            const selectorSearch = cheerio.load(responseSearch.data)
            const searchResult = selectorSearch('div[class="row"] > div')
            const firstSearchUrl = searchResult.first().find('div[class="ct-th"] > a').attr('href')
            if (searchResult.contents().length === 0) {
                return new CustomMessage(response).error({
                    status_code: 404,
                    message: 'Maaf, tidak ada hasil untuk mu',
                }, 404)
            }

            // content page
            const responseContent = await axios.get(firstSearchUrl)
            const selectorContent = cheerio.load(responseContent.data)
            const rootHeader = selectorContent('div[class="if-ct"] > div[class="inf"] > div[class="container"]')
            const rootBody = selectorContent('div[class="container post-outer pt-5 pb-5"] > div > div > div').first()
            const rootDownload = rootBody.find('div[id="content-post"] > table')

            const resultResponse = {}
            resultResponse.thumb = rootHeader.find('div[class="if-th"] > img').attr('src')
            resultResponse.title = rootHeader.find('div[class="if-tt w-50"] > h1').text()
            resultResponse.titleKr = rootHeader.find('div[class="if-tt w-50"] > p')
                .first().text().split('/')[0].trim()
            resultResponse.year = rootHeader.find('div[class="if-tt w-50"] > p')
                .first().text().split('/')[1].trim()
            resultResponse.episode = rootHeader.find('div[class="if-tt w-50"] > p')
                .first().text().split('/')[2].trim()
            resultResponse.genre = rootHeader.find('div[class="if-tt w-50"] > p[class="genres"]')
                .text().replace(/ - /g, ', ')
            resultResponse.duration = rootHeader.find('div[class="if-tt w-50"] > p[class="nt"] > span')
                .text()
            resultResponse.network = rootHeader.find('div[class="if-tt w-50"] > p[class="nt"] > a')
                .text()
            resultResponse.synopsis = rootBody.find('div[id="synopsis"] > p').text()

            // casters
            const tempCasters = []
            rootBody.find('div[class="caster m-3"] > a')
                .each((i, elm) => { tempCasters.push(selectorContent(elm).text()) })
            resultResponse.casters = tempCasters.join(', ')

            // episodes
            resultResponse.episodes = []
            const availableResolution = []
            rootDownload.find('thead > tr > th')
                .each((i, elm) => {
                    if (i > 0) availableResolution.push(selectorContent(elm).text().split(' ')[1])
                })

            rootDownload.find('tbody > tr')
                .each((i, elm) => {
                    const downloads = []
                    const episode = selectorContent(elm).children('td').first().text()

                    // tidak mengambil episode, hanya download link
                    for (let j = 1; j <= availableResolution.length; j++) {
                        const downloadLink = []
                        const resolution = availableResolution[j - 1]

                        // link download
                        selectorContent(
                            selectorContent(elm).children('td').get(j),
                        ).children('a').each((iA, elmA) => {
                            let title = selectorContent(elmA).text()
                            const link = selectorContent(elmA).attr('href')

                            shortTitleDrakorasia.forEach((val) => {
                                if (val.shortName === title) title = val.name
                            })
                            downloadLink.push({ title, link })
                        })
                        // const server = selectorContent(elm).children('td').children('a').text()
                        downloads.push({ resolution, download_link: downloadLink })
                    }
                    resultResponse.episodes.push({ episode, downloads })
                })

            return new CustomMessage(response).success(resultResponse)
        } catch (err) {
            return new CustomMessage(response).error({
                status_code: 500,
                message: err.message,
            }, 500)
        }
    }
}

module.exports = { DrakorasiaController }
