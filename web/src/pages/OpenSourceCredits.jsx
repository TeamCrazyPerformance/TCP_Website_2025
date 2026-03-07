
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const OpenSourceCredits = () => {
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 300) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTocClick = (e, id) => {
        e.preventDefault();
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // 필수/권장 고지 대상 프론트엔드 라이브러리
    const libraries = [
        {
            name: 'FontAwesome',
            packages: '@fortawesome/fontawesome-svg-core, @fortawesome/free-solid-svg-icons, @fortawesome/react-fontawesome',
            license: 'MIT (Code) / CC BY 4.0 (Icons)',
            purpose: '아이콘',
            attribution: true,
            url: 'https://fontawesome.com',
            copyright: 'Copyright (c) Fonticons, Inc.',
            licenseNote: '코드는 MIT 라이선스, 아이콘은 Creative Commons Attribution 4.0 International (CC BY 4.0) 라이선스 하에 제공됩니다. 아이콘 사용 시 저작자 표시가 필요합니다.',
        },
        {
            name: 'React',
            packages: 'react, react-dom',
            license: 'MIT',
            purpose: 'UI 프레임워크',
            attribution: false,
            url: 'https://react.dev',
            copyright: 'Copyright (c) Meta Platforms, Inc. and affiliates.',
            licenseNote: null,
        },
        {
            name: 'React Router',
            packages: 'react-router-dom',
            license: 'MIT',
            purpose: '라우팅',
            attribution: false,
            url: 'https://reactrouter.com',
            copyright: 'Copyright (c) React Training LLC.',
            licenseNote: null,
        },
        {
            name: 'Chart.js',
            packages: 'chart.js, react-chartjs-2',
            license: 'MIT',
            purpose: '차트/그래프',
            attribution: false,
            url: 'https://www.chartjs.org',
            copyright: 'Copyright (c) Chart.js Contributors.',
            licenseNote: null,
        },
        {
            name: 'DOMPurify',
            packages: 'dompurify',
            license: 'Apache 2.0',
            purpose: 'HTML 보안(XSS 방지)',
            attribution: false,
            url: 'https://github.com/cure53/DOMPurify',
            copyright: 'Copyright (c) Mario Heiderich.',
            licenseNote: null,
        },
        {
            name: 'Markdown-it',
            packages: 'markdown-it',
            license: 'MIT',
            purpose: 'Markdown 파싱',
            attribution: false,
            url: 'https://github.com/markdown-it/markdown-it',
            copyright: 'Copyright (c) Vitaly Puzrin, Alex Kocharin.',
            licenseNote: null,
        },
        {
            name: 'Web Vitals',
            packages: 'web-vitals',
            license: 'Apache 2.0',
            purpose: '웹 성능 지표',
            attribution: false,
            url: 'https://github.com/GoogleChrome/web-vitals',
            copyright: 'Copyright (c) Google LLC.',
            licenseNote: null,
        },
    ];

    const mitLicenseText = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

    const apache2LicenseText = `Apache License, Version 2.0

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`;

    const ccby4Text = `Creative Commons Attribution 4.0 International (CC BY 4.0)

You are free to:
  - Share — copy and redistribute the material in any medium or format
  - Adapt — remix, transform, and build upon the material for any purpose, even commercially

Under the following terms:
  - Attribution — You must give appropriate credit, provide a link to the license,
    and indicate if changes were made.

Full license text: https://creativecommons.org/licenses/by/4.0/legalcode`;

    return (
        <main className="container mx-auto px-4 py-10 pt-20 text-left">
            {/* Title & Meta */}
            <section className="mb-8">
                <div className="flex items-start justify-between flex-col lg:flex-row gap-4">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-black gradient-text">오픈소스 고지</h2>
                        <p className="text-gray-400 mt-2">TCP 웹사이트에서 사용하는 오픈소스 소프트웨어의 라이선스 고지입니다.</p>
                    </div>
                    <div className="doc-card p-4 rounded-xl w-full lg:w-auto lg:min-w-[260px] self-stretch lg:self-auto">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400 text-sm">버전</span>
                            <span className="text-white font-semibold">v1.0</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <span className="text-gray-400 text-sm">최종 갱신</span>
                            <span className="text-white">2026-03-07</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Layout: TOC + Document */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* TOC */}
                <aside className="lg:col-span-3">
                    <div className="doc-card rounded-xl p-4 sticky-col max-h-[calc(100vh-100px)] overflow-y-auto">
                        <h3 className="text-lg font-bold mb-3 text-white">목차</h3>
                        <nav className="space-y-1 text-sm">
                            <a href="#sec-attribution" onClick={(e) => handleTocClick(e, 'sec-attribution')} className="toc-link">저작자 표시 (Attribution)</a>
                            <a href="#sec-libraries" onClick={(e) => handleTocClick(e, 'sec-libraries')} className="toc-link">사용 라이브러리 목록</a>
                            <a href="#sec-mit" onClick={(e) => handleTocClick(e, 'sec-mit')} className="toc-link">MIT License 전문</a>
                            <a href="#sec-apache" onClick={(e) => handleTocClick(e, 'sec-apache')} className="toc-link">Apache License 2.0 전문</a>
                            <a href="#sec-ccby4" onClick={(e) => handleTocClick(e, 'sec-ccby4')} className="toc-link">CC BY 4.0 전문</a>
                        </nav>
                    </div>
                </aside>

                {/* Document */}
                <article className="lg:col-span-9 space-y-8">
                    {/* FontAwesome Attribution (Required) */}
                    <section id="sec-attribution" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">저작자 표시 (Attribution)</h3>
                        <div className="bg-gray-800 p-4 rounded-lg">
                            <p className="text-gray-300 leading-7">
                                <strong className="text-yellow-300">Icons by FontAwesome</strong>
                                <br />
                                이 웹사이트에서 사용된 아이콘은{' '}
                                <a href="https://fontawesome.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                                    FontAwesome
                                </a>
                                에서 제공하며,{' '}
                                <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                                    Creative Commons Attribution 4.0 International (CC BY 4.0)
                                </a>{' '}
                                라이선스 하에 사용됩니다.
                            </p>
                            <p className="text-gray-400 text-sm mt-2">Copyright © Fonticons, Inc. All rights reserved.</p>
                        </div>
                    </section>

                    {/* Library List */}
                    <section id="sec-libraries" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">사용 라이브러리 목록</h3>
                        <p className="text-gray-300 leading-7 mb-4">
                            아래는 TCP 웹사이트 프론트엔드에서 사용하는 오픈소스 라이브러리 목록입니다.
                        </p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-300">
                                <thead>
                                    <tr className="border-b border-gray-700">
                                        <th className="py-3 px-4 text-gray-200 font-semibold">라이브러리</th>
                                        <th className="py-3 px-4 text-gray-200 font-semibold">라이선스</th>
                                        <th className="py-3 px-4 text-gray-200 font-semibold">용도</th>
                                        <th className="py-3 px-4 text-gray-200 font-semibold">저작권</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {libraries.map((lib, index) => (
                                        <tr key={index} className="border-b border-gray-800">
                                            <td className="py-3 px-4">
                                                <a
                                                    href={lib.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 underline font-medium"
                                                >
                                                    {lib.name}
                                                </a>
                                                <br />
                                                <span className="text-gray-500 text-xs">{lib.packages}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${lib.license.includes('CC BY')
                                                        ? 'bg-yellow-900 text-yellow-300'
                                                        : lib.license.includes('Apache')
                                                            ? 'bg-orange-900 text-orange-300'
                                                            : 'bg-green-900 text-green-300'
                                                    }`}>
                                                    {lib.license}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">{lib.purpose}</td>
                                            <td className="py-3 px-4 text-xs text-gray-400">{lib.copyright}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {libraries.some(lib => lib.licenseNote) && (
                            <div className="mt-4 space-y-2">
                                {libraries.filter(lib => lib.licenseNote).map((lib, index) => (
                                    <p key={index} className="text-gray-400 text-sm">
                                        ※ <strong>{lib.name}</strong>: {lib.licenseNote}
                                    </p>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* MIT License Full Text */}
                    <section id="sec-mit" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">MIT License 전문</h3>
                        <p className="text-gray-300 leading-7 mb-3">
                            다음 라이브러리에 적용됩니다: <strong>React, React Router, Chart.js, Markdown-it, FontAwesome (코드)</strong>
                        </p>
                        <pre className="bg-gray-800 p-4 rounded-lg text-gray-300 text-sm leading-6 whitespace-pre-wrap overflow-x-auto">{mitLicenseText}</pre>
                    </section>

                    {/* Apache 2.0 License Full Text */}
                    <section id="sec-apache" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">Apache License 2.0 전문</h3>
                        <p className="text-gray-300 leading-7 mb-3">
                            다음 라이브러리에 적용됩니다: <strong>DOMPurify, Web Vitals</strong>
                        </p>
                        <pre className="bg-gray-800 p-4 rounded-lg text-gray-300 text-sm leading-6 whitespace-pre-wrap overflow-x-auto">{apache2LicenseText}</pre>
                    </section>

                    {/* CC BY 4.0 License Full Text */}
                    <section id="sec-ccby4" className="doc-card rounded-xl p-6 section-anchor">
                        <h3 className="text-2xl font-bold text-white mb-3">Creative Commons Attribution 4.0 International (CC BY 4.0)</h3>
                        <p className="text-gray-300 leading-7 mb-3">
                            다음에 적용됩니다: <strong>FontAwesome 아이콘</strong>
                        </p>
                        <pre className="bg-gray-800 p-4 rounded-lg text-gray-300 text-sm leading-6 whitespace-pre-wrap overflow-x-auto">{ccby4Text}</pre>
                    </section>
                </article>
            </section>

            {showBackToTop && (
                <button onClick={scrollToTop} id="backToTop" className="back-to-top cta-button px-3 py-2 rounded-lg text-white text-sm shadow-lg" style={{ display: 'block' }}>
                    <i className="fas fa-arrow-up mr-1"></i>맨 위로
                </button>
            )}
        </main>
    );
};

export default OpenSourceCredits;
