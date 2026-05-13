const sections = document.querySelectorAll('.atuacao, .sobre, .faq');

function revealSections(){

    sections.forEach(section => {

        const sectionTop = section.getBoundingClientRect().top;

        const trigger = window.innerHeight - 100;

        if(sectionTop < trigger){

            section.classList.add('show');

        }

    });

}

window.addEventListener('scroll', revealSections);

window.addEventListener('load', revealSections);

const header = document.querySelector('header');

window.addEventListener('scroll', () => {

    if(window.scrollY > 50){

        header.classList.add('header-scroll');

    } else {

        header.classList.remove('header-scroll');

    }

});