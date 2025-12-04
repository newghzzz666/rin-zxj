import { useTranslation } from 'react-i18next'
import { Button } from '../components/button'
import { Helmet } from 'react-helmet'
import { siteName } from '../utils/constants'

export function ErrorPage({error}: {error?: string}) {
    const { t } = useTranslation()
    return (
        <>
            <Helmet>
                <title>{`${t('error.title')} - ${import.meta.env.VITE_NAME}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('error.title')} />
                <meta property="og:image" content={import.meta.env.VITE_AVATAR} />
            </Helmet>
            <div className="w-full flex flex-row justify-center ani-show">
                    <div className="flex flex-col w-auto rounded-2xl bg-w m-2 p-8 items-center justify-center space-y-4">
                    <i className="ri-error-warning-line text-6xl text-red-500"></i>
                    <h1 className="text-2xl font-bold t-primary">{error}</h1>
                    <Button
                        title={t("index.back")}
                        onClick={() => (window.location.href = "/")}
                    />
                </div>
            </div>
        </>
    );
}
