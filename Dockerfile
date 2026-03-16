FROM php:8.1-apache

# Habilitar módulos necesarios en el servidor
RUN a2enmod rewrite headers

# Copiar todos los archivos al servidor
COPY . /var/www/html/

# Dar permisos de acceso al servidor web
RUN chown -R www-data:www-data /var/www/html

EXPOSE 80