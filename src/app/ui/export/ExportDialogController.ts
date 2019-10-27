import { remote } from 'electron'
import notifier from 'node-notifier'

import { msg } from 'common/i18n/i18n'
import { bindMany } from 'common/util/LangUtil'
import { PhotoExportOptions, Photo, LoadedPhotoSection } from 'common/CommonTypes'

import { closeExportAction, setExportProgressAction } from 'app/state/actions'
import store from 'app/state/store'
import BackgroundClient from 'app/BackgroundClient'
import { showError } from 'app/ErrorPresenter'


interface ExportInfo {
    exportOptions: PhotoExportOptions
    photos: Photo[]
    isCancelled: boolean
}

class ExportDialogController {

    private runningExport: ExportInfo | null

    constructor() {
        bindMany(this, 'startExport', 'cancelExport')
    }

    startExport() {
        if (this.runningExport) {
            this.runningExport.isCancelled = true
        }

        const state = store.getState()
        const exportState = state.export!
        const photoData = (state.data.sections.byId[exportState.sectionId] as LoadedPhotoSection).photoData
        const exportInfo: ExportInfo = {
            exportOptions: exportState.exportOptions,
            photos: exportState.photoIds.map(photoId => photoData[photoId]),
            isCancelled: false
        }

        this.runningExport = exportInfo
        runExport(exportInfo)
            .catch(error => {
                showError('Export failed', error)
            })
            .finally(() => {
                if (this.runningExport === exportInfo) {
                    this.runningExport = null
                }
            })
    }

    cancelExport() {
        if (this.runningExport) {
            this.runningExport.isCancelled = true
        }
        store.dispatch(closeExportAction())
    }

}


async function runExport(exportInfo: ExportInfo): Promise<void> {
    const { exportOptions } = exportInfo
    const photoCount = exportInfo.photos.length

    const filePaths: string[] | undefined = await new Promise(resolve => {
        remote.dialog.showOpenDialog(
            { properties: [ 'openDirectory', 'createDirectory' ] },
            resolve
        )
    })
    if (exportInfo.isCancelled) {
        return
    }
    if (!filePaths) {
        // User cancelled
        store.dispatch(closeExportAction())
        return
    }
    exportOptions.folderPath = filePaths[0]

    for (let photoIndex = 0; photoIndex < photoCount; photoIndex++) {
        store.dispatch(setExportProgressAction({
            processed: photoIndex,
            total: photoCount
        }))

        const photo = exportInfo.photos[photoIndex]
        await BackgroundClient.exportPhoto(photo, exportOptions.folderPath, exportOptions)
        if (exportInfo.isCancelled) {
            return
        }
    }

    notifier.notify({
        title: 'Picturama',
        message: photoCount === 1 ? msg('ExportDialog_done_one') : msg('ExportDialog_done_more', photoCount)
    })

    store.dispatch(closeExportAction())
}


const singleton = new ExportDialogController()
export default singleton
